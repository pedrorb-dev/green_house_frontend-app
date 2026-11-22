# SPEC 02 — Motor de simulación mock y capa de estado (TanStack Query)

> **Estado:** Aprobado
> **Fecha:** 2026-11-21
> **Objetivo:** Implementar el motor de simulación mock (`mock.engine.ts`) que mantiene el estado del invernadero vivo en memoria con un ciclo de 1 s, el repositorio mock (`mock.service.ts`) que implementa `GreenhouseRepository` con latencia simulada, y la capa de estado con TanStack Query (`QueryClientProvider` + `useTelemetry`/`useSendCommand`). El resultado deja `npx tsc --noEmit` en 0 errores y la app arrancable en web y en Expo Go 58 (Android), sin tocar todavía las pantallas finales de Dashboard, Controls ni Settings.

## Alcance

**Dentro:**

- Instalar `@tanstack/react-query` (v5) como dependencia directa, multiplataforma (web, Android, iOS).
- Crear `src/services/mock/mock.engine.ts` con el ciclo interno `setInterval` de 1000 ms, arranque/parada idempotente y limpieza del intervalo.
- Modelar en el motor: clima `DHT11` (oscilación suave 24–27 °C / 55–65 %), suelo capacitivo (evaporación + cálculo inverso de `soilRaw` entre `SOIL.RAW_DRY` y `SOIL.RAW_WET`), riego automático/manual con cooldown `PUMP.COOLDOWN_SEC`, actuadores PWM con _clamp_ estricto, fotoperiodo (`PHOTOPERIOD.DAY_HOURS`/`NIGHT_HOURS`) y compuerta por proximidad (`GATE.PROXIMITY_THRESHOLD_CM`).
- Exponer helpers de _debug_ en el motor (proximidad cerca/lejos, forzar suelo seco, alternar fotoperiodo, fallo de sensor) **sin** contaminar la interfaz pública `GreenhouseRepository`.
- Crear `src/services/mock/mock.service.ts` implementando `GreenhouseRepository` con latencia simulada de 50–100 ms y un singleton `greenhouseRepository` tipado como `GreenhouseRepository`.
- Configurar `QueryClient` y envolver `src/app/_layout.tsx` con `QueryClientProvider` sin romper `ThemeProvider`, `AnimatedSplashOverlay` ni `<Slot />`.
- Crear `src/hooks/useGreenhouse.ts` con `useTelemetry()` (`useQuery` + `refetchInterval: 2000`) y `useSendCommand()` (`useMutation` + invalidación de telemetría en `onSuccess`).
- Dejar `npx tsc --noEmit` en 0 errores y verificar funcionamiento en web y nativo.

**Fuera de alcance (para specs futuras):**

- Vistas finales de `Dashboard`, `Controls` y `Settings` con datos reales (tarjetas, sliders PWM, botón de riego, selector de compuerta, debug en Settings).
- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot.
- NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.
- Persistencia del estado del motor entre recargas.

## Arquitectura y contratos

Flujo de datos: `useTelemetry` / `useSendCommand` → `QueryClient` (TanStack Query) → `greenhouseRepository` (singleton, `GreenhouseRepository`) → `MockEngine` (estado vivo en memoria). Los helpers de debug se exponen **fuera** de `GreenhouseRepository`, vía `mockEngine`, para que Settings los consuma sin acoplarse al contrato de dominio.

### Motor mock — contrato interno

```ts
// src/services/mock/mock.engine.ts

import type {
  CommandDTO,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";

export declare class MockEngine {
  // ciclo de vida (idempotente)
  start(): void; // lanza setInterval(1000) si aún no está corriendo
  stop(): void; // clearInterval y marca el motor como detenido
  getSnapshot(): TelemetryDTO; // copia nueva (nunca la referencia interna)
  apply(command: CommandDTO): void; // despacha un comando del dominio

  // --- helpers de debug (NO forman parte de GreenhouseRepository) ---
  setProximityNear(): void; // proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM (10)
  setProximityFar(): void; // proximityDistanceCm >= 10
  forceSoilDry(): void; // baja soilMoisturePct por debajo de target - hysteresis
  togglePhotoperiod(): void; // alterna DAY <-> NIGHT y reinicia el contador
  setSensorFault(fault: boolean): void; // fuerza dhtOk = !fault
}
```

### Estado interno (no exportado, solo referencia)

```ts
interface MockState {
  // DHT11
  temperatureC: number; // oscila ~24..27
  humidityPct: number; // oscila ~55..65
  dhtOk: boolean; // true salvo fallo simulado
  // suelo capacitivo
  soilMoisturePct: number; // 0..100 calibrado
  soilRaw: number; // derivado: RAW_DRY * (1 - soilMoisturePct / 100)
  // fotoperiodo
  photoperiodState: PhotoperiodState; // "DAY" | "NIGHT"
  secondsToPhotoperiodChange: number;
  // proximidad + compuerta
  proximityDistanceCm: number;
  gateMode: GateMode; // "AUTO" | "OPEN" | "CLOSED"
  gateOpen: boolean;
  // actuadores
  fanActive: boolean; // true en DAY, false en NIGHT
  fanPwm: number; // 230..245 (clamp)
  lightPwm: number; // 0..255 (clamp)
  pumpActive: boolean;
  pumpRunRemainingSec: number; // interno, no se expone en el snapshot
  pumpCooldownRemainingSec: number;
  // umbrales
  targetMoisturePct: number; // 65
  hysteresisPct: number; // 10
}
```

### Reglas del ciclo (cada 1000 ms)

1. **Clima (DHT11):** oscilación suave y determinista con seno: `temperatureC = 25.5 + 1.5 * sin(faseTemp)` (→ 24.0–27.0) y `humidityPct = 60 + 5 * sin(faseHum)` (→ 55–65), con fases que avanzan despacio. Si `dhtOk === false`, se congelan los valores actuales (sensor en fallo).
2. **Suelo:** si `pumpActive`, sube `soilMoisturePct` a ritmo `IRRIGATION_PCT_PER_SEC`; si no, baja a ritmo `EVAPORATION_PCT_PER_SEC`. Se mantiene en `0..100`. Después se recalcula `soilRaw = Math.round(SOIL.RAW_DRY * (1 - soilMoisturePct / 100))` (coherente: 0 % → 4000, 100 % → 0).
3. **Riego automático:** si `!pumpActive && pumpCooldownRemainingSec === 0 && soilMoisturePct < targetMoisturePct - hysteresisPct` → `pumpActive = true; pumpRunRemainingSec = PUMP.MAX_RUN_SEC`.
4. **Duración y apagado del riego:** cada tick con `pumpActive === true` decrementa `pumpRunRemainingSec` en 1. Si `pumpActive && (soilMoisturePct >= targetMoisturePct || pumpRunRemainingSec <= 0)` → `pumpActive = false; pumpCooldownRemainingSec = PUMP.COOLDOWN_SEC`.
5. **Cooldown:** cada tick, si `pumpCooldownRemainingSec > 0` se decrementa en 1. Mientras esté en cooldown se ignoran los riegos (automático y manual).
6. **PWM:** `SET_FAN_PWM` hace _clamp_ estricto de `value` entre `PWM.FAN_MIN` (230) y `PWM.FAN_MAX` (245); `SET_LIGHT_PWM` entre `PWM.LIGHT_MIN` (0) y `PWM.LIGHT_MAX` (255). Fuera de rango se recorta, no se rechaza.
7. **Fotoperiodo:** `secondsToPhotoperiodChange` decrementa cada tick; al llegar a `0`, alterna `DAY` ↔ `NIGHT` y recarga el contador con `PHOTOPERIOD.DAY_HOURS * 3600` o `PHOTOPERIOD.NIGHT_HOURS * 3600`. En cada tick `fanActive = photoperiodState === "DAY"` (conservando el `fanPwm` configurado, igual que el firmware ESP32).
8. **Compuerta:** `gateOpen` se evalúa cada tick según `gateMode`: `"OPEN"` → `true`; `"CLOSED"` → `false`; `"AUTO"` → `proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM` (10).
9. **Umbrales:** `SET_THRESHOLDS` actualiza `targetMoisturePct` (acotado a `0..100`) y `hysteresisPct` (acotado a `0..targetMoisturePct`), evaluando de inmediato si corresponde disparar riego automático.

Constantes internas ajustables (no forman parte del dominio): `EVAPORATION_PCT_PER_SEC` (~0.2) y `IRRIGATION_PCT_PER_SEC` (~2, para alcanzar el objetivo dentro de `PUMP.MAX_RUN_SEC`).

### Repositorio mock — singleton

```ts
// src/services/mock/mock.service.ts

import type { GreenhouseRepository } from "@/domain/repositories/greenhouse.repo";
import type {
  CommandDTO,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";
import { MockEngine } from "@/services/mock/mock.engine";

const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

class MockGreenhouseService implements GreenhouseRepository {
  constructor(private readonly engine: MockEngine) {}

  async getTelemetry(): Promise<TelemetryDTO> {
    await delay(50 + Math.random() * 50); // 50–100 ms
    return this.engine.getSnapshot();
  }

  async sendCommand(command: CommandDTO): Promise<void> {
    await delay(50 + Math.random() * 50);
    this.engine.apply(command);
  }
}

const engine = new MockEngine();
engine.start(); // arranca una sola vez, estado vivo en memoria

export const greenhouseRepository: GreenhouseRepository =
  new MockGreenhouseService(engine);
export { engine as mockEngine }; // helpers de debug para Settings (fuera de GreenhouseRepository)
```

### Hooks

```ts
// src/hooks/useGreenhouse.ts

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UseMutationResult, UseQueryResult } from "@tanstack/react-query";
import { greenhouseRepository } from "@/services/mock/mock.service";
import type {
  CommandDTO,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";

const TELEMETRY_KEY = ["telemetry"] as const;

export function useTelemetry(): UseQueryResult<TelemetryDTO, Error> {
  return useQuery({
    queryKey: TELEMETRY_KEY,
    queryFn: () => greenhouseRepository.getTelemetry(),
    refetchInterval: 2000, // polling cada 2 s
  });
}

export function useSendCommand(): UseMutationResult<
  void,
  Error,
  CommandDTO,
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (command: CommandDTO) =>
      greenhouseRepository.sendCommand(command),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: TELEMETRY_KEY }),
  });
}
```

### Integración en `_layout.tsx`

```tsx
// src/app/_layout.tsx (cambios respecto a SPEC 01)

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// ... imports existentes ...

const queryClient = new QueryClient(); // a nivel de módulo, singleton

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <ThemeProvider value={DefaultTheme}>
        <QueryClientProvider client={queryClient}>
          <AnimatedSplashOverlay />
          <Slot />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

`QueryClientProvider` se anida **dentro** de `ThemeProvider` y envuelve tanto `AnimatedSplashOverlay` como `<Slot />`, conservando intacta la lógica de splash existente.

## Plan de implementación

Cada paso deja la app funcional y arrancable.

1. **Instalar TanStack Query.** `npm install @tanstack/react-query`. Confirmar `@tanstack/react-query` en `package.json` y `package-lock.json` (v5). Verificar: `npx tsc --noEmit` sigue en 0 errores (la lib aún no se usa).

2. **Motor mock — estado, ciclo y clima/suelo.** Crear `src/services/mock/mock.engine.ts` con la clase `MockEngine`, el `MockState` inicial y el `setInterval` de 1000 ms con `start()`/`stop()` idempotentes (limpiando el intervalo en `stop()`). Implementar la oscilación de DHT11, la evaporación del suelo y el cálculo inverso de `soilRaw`. Verificar: `npx tsc --noEmit` en 0 errores.

3. **Motor mock — riego, PWM, fotoperiodo, compuerta y debug.** Implementar `apply(command)` con clamp de PWM (`SET_FAN_PWM`, `SET_LIGHT_PWM`), riego automático/manual (`WATER_PUMP`) con cooldown, decremento de `pumpRunRemainingSec` por tick, fotoperiodo con decremento/alternancia y `fanActive`, `SET_GATE_MODE`/`SET_THRESHOLDS` (con clamp de umbrales) y la evaluación de `gateMode`. Añadir los helpers de debug (`setProximityNear/Far`, `forceSoilDry`, `togglePhotoperiod`, `setSensorFault`). Verificar: `npx tsc --noEmit` en 0 errores.

4. **Repositorio mock.** Crear `src/services/mock/mock.service.ts` con `MockGreenhouseService` (latencia 50–100 ms en ambos métodos) y el singleton `greenhouseRepository`, exportando también `mockEngine`. Verificar: `npx tsc --noEmit` en 0 errores.

5. **QueryClientProvider en `_layout.tsx`.** Crear `const queryClient = new QueryClient()` a nivel de módulo y envolver con `QueryClientProvider` dentro de `ThemeProvider` (abrazando `AnimatedSplashOverlay` y `<Slot />`). Verificar: la app arranca y el splash sigue animándose y desapareciendo en web y nativo.

6. **Hooks `useTelemetry` / `useSendCommand`.** Crear `src/hooks/useGreenhouse.ts` con `useQuery` (`refetchInterval: 2000`) y `useMutation` (invalidación de `["telemetry"]` en `onSuccess`). Verificar: `npx tsc --noEmit` en 0 errores.

7. **Verificación final web y nativo.** `npm run web` sin errores y `npx expo start -c --android` en Expo Go 58 (Android): splash indigo, 3 pestañas placeholder visibles, sin pantalla en blanco. Confirmar (logs o consumo temporal en un placeholder) que el motor late cada segundo y que los hooks no rompen el render. Las pantallas siguen compilando como placeholders.

## Criterios de aceptación

- [ ] `npx tsc --noEmit` termina con 0 errores.
- [ ] `@tanstack/react-query` está declarado en `package.json` y `package-lock.json` (v5).
- [ ] `src/services/mock/mock.engine.ts` expone `start()`, `stop()`, `getSnapshot()`, `apply()` y los 5 helpers de debug, y `stop()` limpia el intervalo.
- [ ] El clima oscila en 24–27 °C / 55–65 % con `dhtOk: true`, y `soilRaw` es coherente con `soilMoisturePct` (0 % → 4000, 100 % → 0).
- [ ] El riego automático enciende por debajo de `targetMoisturePct - hysteresisPct`, apaga al alcanzar `targetMoisturePct` o `PUMP.MAX_RUN_SEC`, y activa un cooldown de `PUMP.COOLDOWN_SEC` que decrementa segundo a segundo e ignora riegos mientras dura.
- [ ] `SET_FAN_PWM` queda acotado a 230–245 y `SET_LIGHT_PWM` a 0–255 (clamp estricto).
- [ ] El fotoperiodo decrementa `secondsToPhotoperiodChange`, alterna `DAY`/`NIGHT` al llegar a 0, y `fanActive` es `true` en `DAY` y `false` en `NIGHT` (conservando `fanPwm`).
- [ ] En modo `AUTO`, `gateOpen` es `true` solo cuando `proximityDistanceCm < 10`.
- [ ] `src/services/mock/mock.service.ts` implementa `GreenhouseRepository` con latencia 50–100 ms y exporta el singleton `greenhouseRepository`.
- [ ] `_layout.tsx` envuelto con `QueryClientProvider` sin romper `ThemeProvider`, `AnimatedSplashOverlay` ni `<Slot />`.
- [ ] `src/hooks/useGreenhouse.ts` expone `useTelemetry()` (`refetchInterval: 2000`) y `useSendCommand()` (invalidación de telemetría en `onSuccess`).
- [ ] `npm run web` arranca sin errores y Expo Go 58 (Android) muestra las 3 pestañas placeholder sin pantalla en blanco.
- [ ] Los helpers de debug no aparecen en la interfaz pública `GreenhouseRepository` (solo vía `mockEngine`).

## Decisiones tomadas y descartadas

- **Sí:** motor como clase `MockEngine` con `setInterval(1000)` interno y `start()`/`stop()` idempotentes; el singleton `greenhouseRepository` lo arranca una sola vez y `stop()` hace `clearInterval` para evitar fugas.
- **Sí:** separar el debug de la interfaz pública. Los helpers viven en `MockEngine`/`mockEngine` y se exportan aparte, para que Settings los use sin ensuciar `GreenhouseRepository`.
- **Sí:** latencia simulada de 50–100 ms en `getTelemetry()` y `sendCommand()` para ejercitar estados de carga reales (`isLoading`, `isPending`) en la UI.
- **Sí:** `refetchInterval: 2000` para el polling y invalidación en `onSuccess` del mutation para refrescar la telemetría inmediatamente tras cada comando.
- **Sí:** _clamp_ estricto de PWM (los valores fuera de rango se recortan, no se rechazan), igual que el firmware ESP32.
- **Sí:** fotoperiodo con horario real (13 h / 11 h → 46800 s / 39600 s); `togglePhotoperiod()` permite forzar el cambio en Settings sin esperar horas.
- **Sí:** singleton `greenhouseRepository` tipado como `GreenhouseRepository` para que en el futuro se intercambie por `ApiGreenhouseService` sin tocar los hooks.
- **Sí:** TanStack Query v5, compatible con React 19.3.
- **No:** exponer el `MockEngine` completo a través de `GreenhouseRepository`.
- **No:** ciclo de fotoperiodo acelerado por defecto en el motor (se mantiene el horario real del dominio).
- **No:** pantallas finales ni cliente HTTP/STOMP; van en specs posteriores.

## Riesgos

| Riesgo                                                                   | Mitigación                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `setInterval` fugado (memory leak) si el motor se reinstancia o desmonta | `start()` idempotente guarda el `intervalId`; `stop()` hace `clearInterval`. Singleton único en el módulo.         |
| La UI muta el snapshot y comparte referencias con el estado interno      | `getSnapshot()` devuelve siempre un objeto nuevo; el estado interno no se expone directamente.                     |
| Romper splash/ThemeProvider al añadir `QueryClientProvider`              | Anidarlo dentro de `ThemeProvider` conservando `AnimatedSplashOverlay` y `<Slot />`; verificación en el paso 5.    |
| Inferencia de tipos genéricos de `useQuery`/`useMutation` incorrecta     | Tipar `queryKey`/`mutationFn` y los retornos `UseQueryResult`/`UseMutationResult`; validar con `npx tsc --noEmit`. |
| Riego/cooldown disparado en el primer tick con suelo húmedo              | Encender solo si `soilMoisturePct < target - hysteresis` y `pumpCooldownRemainingSec === 0`; cooldown inicial 0.   |
| Versión de TanStack Query incompatible con React 19.3                    | Instalar v5 (soporta React 19) y verificar arranque en web y Expo Go 58.                                           |

## Qué **no** está en esta spec

- Vistas finales de `Dashboard`, `Controls` y `Settings` con datos reales (tarjetas, sliders PWM, botón de riego, selector de compuerta, panel de debug).
- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot.
- NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.
- Persistencia del estado del motor entre recargas.

Cada uno de esos, si llega, va en su propia spec.
