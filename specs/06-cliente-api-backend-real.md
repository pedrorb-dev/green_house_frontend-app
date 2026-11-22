# SPEC 06 — Cliente HTTP real y conexión al backend Spring Boot

> **Estado:** Aprobado
> **Depende de:** SPEC 01, SPEC 02, SPEC 03, SPEC 04, SPEC 05
> **Fecha:** 2026-11-22
> **Objetivo:** Conectar la app al backend Spring Boot real mediante un cliente HTTP (`src/services/api/api.service.ts`) seleccionable por variables de entorno `EXPO_PUBLIC_USE_MOCK`/`EXPO_PUBLIC_API_URL`, exponiendo el estado online del ESP32 (cabecera `X-Device-Online`), el `CommandDTO` normalizado que responde el servidor y el mapeo de errores `ErrorResponse` (404/409/502/400), con un cambio mínimo en `GreenhouseRepository`, `useGreenhouse`, el badge de conexión de las tres pantallas y los mensajes de error de las tarjetas.

## Alcance

**Dentro:**

- Dos variables de entorno `EXPO_PUBLIC_*`: `EXPO_PUBLIC_USE_MOCK` (`"true"`/`"false"`, default `"false"`) y `EXPO_PUBLIC_API_URL` (default `"http://localhost:8080"`), más un `.env.example` documentado.
- Un cliente HTTP real `src/services/api/api.service.ts` que implementa la **misma interfaz** `GreenhouseRepository` que el mock, usando `fetch` (sin dependencias nuevas).
- `GET /api/v1/greenhouse/telemetry`: parsear los 17 campos del `TelemetryDTO` y leer `X-Device-Online` (`"true"`/`"false"`) para exponer el estado real de conexión del ESP32.
- `POST /api/v1/greenhouse/commands`: enviar el `CommandDTO` y devolver el `CommandDTO` normalizado del servidor (reflejando el _clamp_, p. ej. `SET_FAN_PWM` a `230..245`).
- Métodos tipados (no cableados a UI) `GET /api/v1/health` y `GET /api/v1/greenhouse/telemetry/history?range=1h|6h|24h|7d`.
- Mapeo del formato `ErrorResponse` (`{ error, message, timestamp }`) a mensajes de usuario: `404 TELEMETRY_NOT_AVAILABLE` (esperando primera lectura), `409 COMMAND_REJECTED` (bomba regando/cooldown 30 s), `502 MQTT_PUBLISH_ERROR` (pérdida backend↔MQTT), `400 INVALID_COMMAND`/`VALIDATION_FAILED`/`BAD_REQUEST`.
- Badge de conexión dinámico en las 3 pantallas (mock / ESP32 conectado / sin conexión).
- Cambio de la interfaz `GreenhouseRepository` para devolver `{ telemetry, deviceOnline }` y `Promise<CommandDTO>` (decisión confirmada).

**Fuera de alcance (para specs futuras):**

- WebSockets STOMP o `@stomp/stompjs`: se mantiene el polling REST de 2 s.
- Pantalla/gráfica de histórico: los métodos `getHealth`/`getTelemetryHistory` quedan tipados pero sin UI.
- Persistencia (`AsyncStorage`) de umbrales o cualquier estado entre recargas.
- Autenticación, reintentos con backoff, cacheo offline o `eas.json`.
- Modificación del backend (CORS y endpoints ya están listos); si algo fallara ahí, va en otra spec.

## Arquitectura y contratos

### Contratos de dominio nuevos (`src/domain/models/greenhouse.types.ts`)

```ts
export interface TelemetryResponse {
  telemetry: TelemetryDTO;
  deviceOnline: boolean; // de la cabecera X-Device-Online
}

export type HistoryRange = "1h" | "6h" | "24h" | "7d";

export interface TelemetryHistoryPoint {
  timestamp: string; // ISO-8601 (Instant)
  temperatureC: number | null;
  humidityPct: number | null;
  soilMoisturePct: number | null;
  lightPwm: number | null;
  fanPwm: number | null;
}

export interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
  deviceOnline: boolean;
  lastTelemetryAt: string | null;
}

export interface ErrorResponse {
  error: string; // código estable del backend
  message: string; // descripción técnica
  timestamp: string;
}
```

`TelemetryDTO` (17 campos) y `CommandDTO` (5 variantes) **no cambian**: se verificó paridad 1:1 con el backend (`SetFanPwm(int value)`, `SetLightPwm(int value)`, `SetGateMode(GateMode value)`, `WaterPump()`, `SetThresholds(int targetMoisturePct, int hysteresisPct)`), serializados con discriminador `"type"`.

### Cambio de interfaz (`src/domain/repositories/greenhouse.repo.ts`)

```ts
export interface GreenhouseRepository {
  getTelemetry(): Promise<TelemetryResponse>;
  sendCommand(command: CommandDTO): Promise<CommandDTO>;
}
```

### Cliente HTTP (`src/services/api/api.service.ts`)

```ts
export class ApiError extends Error {
  readonly status: number; // HTTP status
  readonly code: string; // ErrorResponse.error
}
export function getUserFacingMessage(error: unknown): string;
export function createApiGreenhouseRepository(opts: {
  baseUrl: string;
}): GreenhouseRepository & {
  getHealth(): Promise<HealthResponse>;
  getTelemetryHistory(range: HistoryRange): Promise<TelemetryHistoryPoint[]>;
};
```

- `getTelemetry()`: `fetch(`${baseUrl}/api/v1/greenhouse/telemetry`)` → `response.json()` como `TelemetryDTO` + `deviceOnline = response.headers.get("X-Device-Online") === "true"`. En `!response.ok` se parsea `ErrorResponse` y se lanza `ApiError`.
- `sendCommand(cmd)`: `POST ${baseUrl}/api/v1/greenhouse/commands` con `Content-Type: application/json` y `body: JSON.stringify(cmd)` → devuelve `response.json()` (el `CommandDTO` normalizado). En `!response.ok`, lanza `ApiError`.
- `getHealth()` y `getTelemetryHistory(range)` tipados, listos para uso futuro.

### Mapeo de errores (`getUserFacingMessage`)

| `ErrorResponse.error`                                   | HTTP | Mensaje de usuario                                       |
| ------------------------------------------------------- | ---- | -------------------------------------------------------- |
| `TELEMETRY_NOT_AVAILABLE`                               | 404  | `Esperando la primera lectura del ESP32…`                |
| `COMMAND_REJECTED`                                      | 409  | `La bomba está regando o en espera de seguridad (30 s).` |
| `MQTT_PUBLISH_ERROR`                                    | 502  | `Se perdió la comunicación con el broker MQTT.`          |
| `INVALID_COMMAND` / `VALIDATION_FAILED` / `BAD_REQUEST` | 400  | `Comando inválido: revisa los valores.`                  |
| `INFLUX_QUERY_ERROR`                                    | 502  | `Error al consultar el histórico.`                       |
| (default / error de red)                                | —    | `No se pudo conectar con el servidor.`                   |

### Selección mock/API (`src/services/index.ts`, barril)

```ts
export const isMock = process.env.EXPO_PUBLIC_USE_MOCK === "true";
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080";
export const greenhouseRepository: GreenhouseRepository = isMock
  ? createMockGreenhouseRepository()
  : createApiGreenhouseRepository({ baseUrl: API_URL });
export { mockEngine } from "@/services/mock/mock.service";
```

- `useGreenhouse.ts` importa `greenhouseRepository` e `isMock` desde este barril (ya no desde `mock.service.ts`).
- **Mock con arranque perezoso:** `mock.service.ts` deja de ejecutar `engine.start()` al importar; lo mueve a `createMockGreenhouseRepository()` (idempotente gracias al guard `intervalId !== null`). `mockEngine` sigue exportado como singleton para `SimulationDebugCard`, pero ya no dispara el intervalo en modo API.
- `getTelemetry()` del mock devuelve `{ telemetry: engine.getSnapshot(), deviceOnline: true }`; `sendCommand()` aplica y devuelve el mismo `CommandDTO`.

### `useGreenhouse.ts`

```ts
export function useTelemetry(): UseQueryResult<TelemetryResponse, Error>; // retry:false + refetchInterval:2000
export function useSendCommand(): UseMutationResult<
  CommandDTO,
  Error,
  CommandDTO,
  unknown
>;
```

- `retry: false` para que un 404 no caiga en backoff exponencial; `refetchInterval: 2000` es el mecanismo de auto-recuperación (cuando llega la primera lectura, la query pasa a `success` sola).

### Badge de conexión (`src/components/ui/ConnectionBadge.tsx`)

```ts
interface ConnectionBadgeProps {
  isMock: boolean;
  deviceOnline?: boolean; // undefined = cargando / sin datos
}
```

| Estado                                  | Punto           | Texto                  |
| --------------------------------------- | --------------- | ---------------------- |
| `isMock`                                | verde `#22C55E` | `En vivo • Simulación` |
| `!isMock && deviceOnline === undefined` | ámbar `#F59E0B` | `Conectando…`          |
| `!isMock && deviceOnline === true`      | verde `#22C55E` | `En vivo • ESP32`      |
| `!isMock && deviceOnline === false`     | ámbar `#F59E0B` | `Sin conexión ESP32`   |

### Pantallas y tarjetas

- `index.tsx`, `controls.tsx`, `settings.tsx`: `data` ahora es `TelemetryResponse` → las tarjetas reciben `data.telemetry.*`; el header usa `<ConnectionBadge isMock={isMock} deviceOnline={data?.deviceOnline} />`; la rama `isError` muestra `getUserFacingMessage(error)` (y conserva el botón `Reintentar` → `refetch()`).
- `settings.tsx`: renderiza `SimulationDebugCard` solo cuando `isMock === true`; en modo API la cuadrícula queda con `ThresholdsCard` + `FirmwareRulesCard`.
- Las 5 tarjetas de comando (`PumpControlCard`, `FanControlCard`, `LightControlCard`, `GateControlCard`, `ThresholdsCard`) sustituyen su aviso inline genérico por `getUserFacingMessage(error)`.

## Plan de implementación

Cada paso deja la app arrancable y `npx tsc --noEmit` en 0 errores.

1. **Contratos de dominio.** Añadir `TelemetryResponse`, `HistoryRange`, `TelemetryHistoryPoint`, `HealthResponse` y `ErrorResponse` a `src/domain/models/greenhouse.types.ts` (solo adiciones). Verificar `npx tsc --noEmit` (verde).

2. **Núcleo de datos (cambio de interfaz + implementaciones + hook + desenvoltura de `data`).** Cambiar `GreenhouseRepository` a `getTelemetry(): Promise<TelemetryResponse>` y `sendCommand(): Promise<CommandDTO>`. Actualizar `mock.service.ts` (wrapper `{ telemetry, deviceOnline: true }`, echo del comando, `createMockGreenhouseRepository()` con arranque perezoso). Crear `api.service.ts` (`ApiError`, `getUserFacingMessage`, `createApiGreenhouseRepository` con `getHealth`/`getTelemetryHistory` tipados) y el barril `src/services/index.ts`. Actualizar `useGreenhouse.ts` (importar del barril, `retry:false`, tipos nuevos) y desenvuelve `data.telemetry` en `index.tsx`, `controls.tsx` y `settings.tsx` (lo mínimo para compilar). Verificar `npx tsc --noEmit`.

3. **Badge de conexión.** Crear `src/components/ui/ConnectionBadge.tsx` (4 estados) e insertarlo en el header de las 3 pantallas; ocultar `SimulationDebugCard` en `settings.tsx` cuando `!isMock`. Verificar `npx tsc --noEmit`.

4. **Mapeo de errores en UI.** Sustituir el texto de error inline por `getUserFacingMessage(error)` en la rama `isError` de telemetría de las 3 pantallas y en las 5 tarjetas de comando. Verificar `npx tsc --noEmit`.

5. **Variables de entorno.** Crear `.env.example` (committed) con `EXPO_PUBLIC_USE_MOCK=false` y `EXPO_PUBLIC_API_URL=http://localhost:8080`, y documentar en él: Expo Web usa `http://localhost:8080`, emulador Android `http://10.0.2.2:8080` y dispositivo físico la IP local `http://192.168.x.x:8080`. Nota: los `EXPO_PUBLIC_*` se inyectan en build; un cambio exige reiniciar `expo start` con `-c`. Los valores locales van en `.env.local` (ya ignorado por `.gitignore`). Verificar `npx tsc --noEmit`.

6. **Verificación E2E** (detalle en "Criterios de aceptación"): backend con simulador + Expo Web contra `localhost:8080`, polling 2 s, lectura de `X-Device-Online`, envío de comandos con _clamp_ y error 409 en cooldown.

## Criterios de aceptación

- [ ] `npx tsc --noEmit` termina con 0 errores.
- [ ] No se añaden dependencias a `package.json` (cliente con `fetch`).
- [ ] `GreenhouseRepository.getTelemetry()` devuelve `Promise<TelemetryResponse>` y `sendCommand()` devuelve `Promise<CommandDTO>`.
- [ ] Con `EXPO_PUBLIC_USE_MOCK=false`, `useTelemetry()` resuelve `{ telemetry, deviceOnline }` desde `GET /api/v1/greenhouse/telemetry` y lee `X-Device-Online` correctamente.
- [ ] `POST /api/v1/greenhouse/commands` devuelve el `CommandDTO` normalizado; p. ej. `SET_FAN_PWM` con `value: 250` responde `{ type: "SET_FAN_PWM", value: 245 }`.
- [ ] `GET /api/v1/health` y `GET /api/v1/greenhouse/telemetry/history?range=…` están tipados y listos (aunque sin UI).
- [ ] El badge de las 3 pantallas muestra: `En vivo • Simulación` (mock), `En vivo • ESP32` (API + online), `Sin conexión ESP32` (API + offline), `Conectando…` (cargando).
- [ ] Un 404 `TELEMETRY_NOT_AVAILABLE` muestra `Esperando la primera lectura del ESP32…` y se auto-recupera sin recargar cuando llega la primera lectura (polling 2 s, `retry:false`).
- [ ] Un 409 `COMMAND_REJECTED` muestra `La bomba está regando o en espera de seguridad (30 s).` en la tarjeta de comando, sin perder el borrador.
- [ ] Un 502 `MQTT_PUBLISH_ERROR` muestra `Se perdió la comunicación con el broker MQTT.`.
- [ ] En modo API, `SimulationDebugCard` no se renderiza y `mockEngine` no arranca ningún `setInterval`.
- [ ] En modo mock, `SimulationDebugCard` sigue funcionando y el badge dice `En vivo • Simulación`.
- [ ] Con el backend arriba (`docker compose up -d` + `.\mvnw.cmd spring-boot:run -Dspring-boot.run.arguments=--greenhouse.simulator.enabled=true`), Expo Web en `localhost:8081` refleja telemetría que cambia cada 2 s y los comandos se aplican (fan/luz _clamp_, bomba con cooldown).

## Decisiones tomadas y descartadas

- **Sí:** wrapper `TelemetryResponse { telemetry, deviceOnline }` (y no un método/hook aparte). Una sola fuente de verdad; la cabecera se lee en cada poll de 2 s y el mock devuelve `deviceOnline: true` sin lógica.
- **Sí:** cambiar `sendCommand()` a `Promise<CommandDTO>`. El servidor devuelve el comando normalizado; hoy ninguna tarjeta lee `mutation.data`, así que el cambio es transparente para la UI.
- **Sí:** `fetch` nativo en lugar de añadir Axios. Evita una dependencia y cubre los 4 endpoints; el parseo de cabeceras y errores es trivial.
- **Sí:** barril `src/services/index.ts` como punto único de selección mock/API. `useGreenhouse.ts` deja de importar de `mock.service.ts`.
- **Sí:** arranque perezoso del `MockEngine` (quitar `engine.start()` del módulo). En modo API no se crea ningún intervalo; `SimulationDebugCard` solo se renderiza en modo mock.
- **Sí:** `retry: false` + `refetchInterval: 2000` para la telemetría. Un 404 inicial no debe caer en backoff exponencial; el poll de 2 s ya es la recuperación.
- **Sí:** extraer `ConnectionBadge` en `src/components/ui/` para no triplicar el markup/estilos del badge en 3 pantallas.
- **Sí:** `getUserFacingMessage(error)` centralizado (y no disperso por tarjeta). Un solo mapa código→mensaje, con fallback genérico para errores de red o del mock.
- **Sí:** valores locales en `.env.local` (ya gitignored) y solo `.env.example` commitido, sin tocar `.gitignore`.
- **No:** WebSockets/STOMP, gráficas de histórico, `AsyncStorage`, autenticación ni cambios en el backend (CORS ya expone `X-Device-Online` para `localhost:8081`/`8082`/`192.168.*`/`10.*`).

## Riesgos

| Riesgo                                                                              | Mitigación                                                                                                        |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Cambiar la interfaz `GreenhouseRepository` rompe mock + hook + 3 pantallas a la vez | Se agrupa en el paso 2 (núcleo de datos) y se verifica `npx tsc --noEmit` al final de cada paso.                  |
| La cabecera `X-Device-Online` no sea legible por CORS en Expo Web                   | El backend ya la expone en `exposedHeaders`; se verifica en el E2E. Si faltara, es cambio de backend (otra spec). |
| `EXPO_PUBLIC_*` no se recargue al editar `.env`                                     | Se documenta: reiniciar `expo start` con `-c`; los valores se inyectan en build.                                  |
| En dispositivo físico Android, `localhost:8080` apunta al propio teléfono           | Documentar la IP local (`192.168.x.x`) y `10.0.2.2` para emulador en `.env.example`.                              |
| 404 inicial de telemetría parezca un error fatal                                    | `retry:false` + poll 2 s + mensaje `Esperando la primera lectura del ESP32…` con auto-recuperación.               |
| `getUserFacingMessage` reciba un `Error` del mock (no `ApiError`)                   | Fallback genérico `No se pudo conectar con el servidor.`; no rompe el modo mock.                                  |

## Qué **no** está en esta spec

- WebSockets STOMP / `@stomp/stompjs` y suscripción push.
- Pantalla o gráfica de histórico (los métodos quedan tipados, sin UI).
- Persistencia en `AsyncStorage`, autenticación, cacheo offline.
- Cambios en el backend Spring Boot (contratos, CORS y endpoints ya existen y se verificaron).
- Pruebas unitarias, CI o `eas.json`.

Cada uno de esos, si llega, va en su propia spec.
