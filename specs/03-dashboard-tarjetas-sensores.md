# SPEC 03 — Pantalla Dashboard y tarjetas de sensores

> **Estado:** Aprobado
> **Fecha:** 2026-11-21
> **Objetivo:** Implementar la pantalla `Dashboard` (`src/app/(tabs)/index.tsx`) de solo lectura que consume `useTelemetry()` con polling de 2 s y maneja los estados de carga/error/datos, y los cuatro componentes de sensor (`ClimateCard`, `SoilMoistureCard`, `PhotoperiodCard`, `AccessGateCard`) en `src/components/sensors/`, con encabezado de estado global, banners de riego y layout responsivo (apilado en móvil, 2 columnas en web), dejando `npx tsc --noEmit` en 0 errores y verificando en web y en Expo Go 58 (Android).

## Alcance

**Dentro:**

- Reemplazar el placeholder de `src/app/(tabs)/index.tsx` por una pantalla de solo lectura que consume **exclusivamente** `useTelemetry()`. Sin `useSendCommand` ni ningún botón de accionamiento.
- Manejar los tres estados de consulta: `isLoading` (indicador de carga), `isError` (tarjeta de aviso + botón para `refetch()`) y datos vivos que se refrescan cada 2 s vía `refetchInterval`.
- Encabezado con badge de telemetría (`"En vivo • Simulación"`) y banners destacados cuando `pumpActive === true` o `pumpCooldownRemainingSec > 0` (con segundos restantes).
- Cuatro componentes de sensor en `src/components/sensors/`: `ClimateCard`, `SoilMoistureCard`, `PhotoperiodCard`, `AccessGateCard`, con el contenido especificado en la sección de arquitectura.
- Funciones puras de formateo y helpers visuales en un único módulo (`src/components/sensors/format.ts`).
- Layout responsivo con `ScrollView`: tarjetas apiladas en móvil y en cuadrícula de 2 columnas en pantallas anchas (contenedor con `MaxContentWidth`).
- Reutilizar la paleta `AppColors`, `Spacing`, `MaxContentWidth` y los iconos Ionicons de `@expo/vector-icons`.

**Fuera de alcance (para specs futuras):**

- Pantalla `Controls` (sliders PWM, riego manual, selector de modo de compuerta) → **SPEC 04**.
- Pantalla `Settings` (formulario de umbrales y botones de debug del `mockEngine`) → **SPEC 05**.
- Gráficas históricas de sensores.
- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot.
- NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.

## Arquitectura y contratos

La pantalla depende de los contratos de dominio de SPEC 01 (`TelemetryDTO`, constantes) y de la capa de estado de SPEC 02 (`useTelemetry`, `QueryClientProvider`). No se modifica el motor ni el repositorio: solo se leen los datos ya expuestos.

Flujo: `useTelemetry()` → `QueryClient` → `greenhouseRepository.getTelemetry()` → `TelemetryDTO` → componentes de presentación.

### Funciones puras de formateo — `src/components/sensors/format.ts`

Sin estado ni dependencias de React. Cada una recibe campos del `TelemetryDTO` y devuelve texto o número listo para pintar.

```ts
export type SoilStateLabel =
  | "Óptimo"
  | "Seco / Riego pendiente"
  | "Regando"
  | "En espera de seguridad";

export function formatCelsius(celsius: number): string; // "25.4 °C" (1 decimal)
export function formatClock(totalSeconds: number): string; // "HH:MM:SS"
export function roundPercent(value: number): number; // Math.round acotado a 0..100 (evita 64.80000000000001)
export function lightPwmToPercent(lightPwm: number): number; // roundPercent(pwm / PWM.LIGHT_MAX * 100) → 0..100
export function formatGateOpen(gateOpen: boolean): string; // "Abierta (45°)" | "Cerrada (0°)"
export function formatGateMode(gateMode: GateMode): string; // "Automático" | "Abierta" | "Cerrada"
export function formatPhotoperiod(state: PhotoperiodState): string; // "Día · Luz activa" | "Noche · Reposo"

export function soilStateLabel(args: {
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
  soilMoisturePct: number;
  targetMoisturePct: number;
  hysteresisPct: number;
}): SoilStateLabel;
```

**Precedencia de `soilStateLabel`** (la primera condición que cumpla gana):

1. `pumpActive === true` → `"Regando"`.
2. `pumpCooldownRemainingSec > 0` → `"En espera de seguridad"` (la tarjeta muestra aparte los segundos restantes).
3. `soilMoisturePct < targetMoisturePct - hysteresisPct` → `"Seco / Riego pendiente"`.
4. En cualquier otro caso → `"Óptimo"`.

### Componentes — `src/components/sensors/`

Cada componente recibe **solo los campos que necesita** (no el `TelemetryDTO` completo) y es puramente presentacional.

```ts
// src/components/sensors/ClimateCard.tsx
interface ClimateCardProps {
  temperatureC: number;
  humidityPct: number;
  dhtOk: boolean;
}
```

- `temperatureC` formateado a 1 decimal (°C); `humidityPct` como `%` HR.
- Si `dhtOk === false`: alerta visual destacada indicando fallo de lectura del DHT11 y que se muestran los últimos valores retenidos.

```ts
// src/components/sensors/SoilMoistureCard.tsx
interface SoilMoistureCardProps {
  soilMoisturePct: number; // 0..100
  soilRaw: number; // 0..4000 ADC
  targetMoisturePct: number; // default 65
  hysteresisPct: number; // default 10
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
}
```

- Muestra `%`, lectura cruda ADC `soilRaw`, barra de progreso (relleno `roundPercent(soilMoisturePct)`).
- El texto del porcentaje y el `width` de la barra usan **el mismo** valor redondeado (`roundPercent`), evitando artefactos de coma flotante como `64.80000000000001`.
- Marcas de referencia en la barra: objetivo `targetMoisturePct` y umbral de encendido `targetMoisturePct - hysteresisPct`, posicionadas con `left` en porcentaje (por ejemplo `{ left: pct + '%' }`) y `transform: [{ translateX: -1 }]` para centrarlas y evitar desbordes cuando el objetivo llega a `100%`.
- Etiqueta de estado vía `soilStateLabel` (con segundos restantes cuando esté en espera de seguridad).

```ts
// src/components/sensors/PhotoperiodCard.tsx
interface PhotoperiodCardProps {
  photoperiodState: PhotoperiodState;
  secondsToPhotoperiodChange: number;
  lightPwm: number; // 0..255
  fanActive: boolean;
  fanPwm: number; // 230..245
}
```

- Fase actual (`Día · Luz activa` / `Noche · Reposo`).
- Cuenta regresiva `formatClock(secondsToPhotoperiodChange)`.
- Intensidad del foco: `lightPwm` (escala 0–255) y su porcentaje `lightPwmToPercent` (0–100 %).
- Ventilador: `fanActive` (Encendido/Apagado) junto al `fanPwm` configurado.

```ts
// src/components/sensors/AccessGateCard.tsx
interface AccessGateCardProps {
  proximityDistanceCm: number;
  gateOpen: boolean;
  gateMode: GateMode;
}
```

- Distancia `proximityDistanceCm` (cm), estado físico `formatGateOpen(gateOpen)`, modo `formatGateMode(gateMode)`.
- Resaltado de proximidad cuando `proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM` (10 cm).

### Carcasa compartida — `src/components/sensors/SensorCard.tsx`

Las cuatro tarjetas comparten contenedor, fila de título + icono Ionicons y estilos. Se extrae una carcasa `SensorCard` (props `title`, `icon`, `children`, `accent?`) para no duplicar estilos. El prop `icon` se tipa estricto, no como `string`, para que `tsc` valide el nombre del icono y conserve el autocompletado:

```ts
// src/components/sensors/SensorCard.tsx
import type { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";

interface SensorCardProps {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  accent?: string;
  children: ReactNode;
}
```

### Estructura de `src/app/(tabs)/index.tsx`

```
DashboardScreen
  useTelemetry()  → { data, isLoading, isError, refetch }
  <ScrollView> (contentContainer centrado, maxWidth: MaxContentWidth)
    <Header>  (título + badge "En vivo • Simulación")
    si isLoading → <ActivityIndicator> centrado
    si isError  → tarjeta de aviso + botón "Reintentar" → refetch()
    si data     → banners de riego + cuadrícula de las 4 tarjetas
```

- **Badge:** punto verde + texto `"En vivo • Simulación"` (la fuente es el mock; no hay estado real de conexión).
- **Banner riego activo:** visible solo si `data.pumpActive === true` → `"Bomba regando…"`.
- **Banner cooldown:** visible solo si `data.pumpCooldownRemainingSec > 0` → `"En espera de seguridad (Ns)"` con `N` = segundos restantes.
- **Cuadrícula:** contenedor `View` con `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: Spacing.three`; cada tarjeta con `flexGrow: 1` y `flexBasis: 300`. En web (ancho ≤ 800) da 2 columnas; en móvil (~360 px) se apila a 1 columna, sin media queries ni NativeWind.

## Plan de implementación

Cada paso deja la app funcional y arrancable.

1. **Helpers de formateo.** Crear `src/components/sensors/format.ts` con `formatCelsius`, `formatClock`, `roundPercent`, `lightPwmToPercent`, `formatGateOpen`, `formatGateMode`, `formatPhotoperiod`, `soilStateLabel` y el tipo `SoilStateLabel`. Verificar: `npx tsc --noEmit` en 0 errores.

2. **Carcasa `SensorCard`.** Crear `src/components/sensors/SensorCard.tsx` con `title`, `icon` tipado como `React.ComponentProps<typeof Ionicons>["name"]`, `accent?` y `children`, usando `AppColors` y `Spacing`. Verificar: `npx tsc --noEmit` en 0 errores.

3. **`ClimateCard`.** Crear `src/components/sensors/ClimateCard.tsx` con temperatura (1 decimal), humedad y alerta de `dhtOk === false`. Verificar: `npx tsc --noEmit` en 0 errores.

4. **`SoilMoistureCard`.** Crear `src/components/sensors/SoilMoistureCard.tsx` con barra de progreso (texto y `width` con `roundPercent`), marcas de objetivo/umbral (`left` en % + `translateX: -1`), `soilRaw` y estado vía `soilStateLabel`. Verificar: `npx tsc --noEmit` en 0 errores.

5. **`PhotoperiodCard`.** Crear `src/components/sensors/PhotoperiodCard.tsx` con fase, cuenta regresiva `HH:MM:SS`, foco (`lightPwm` + %) y ventilador (`fanActive` + `fanPwm`). Verificar: `npx tsc --noEmit` en 0 errores.

6. **`AccessGateCard`.** Crear `src/components/sensors/AccessGateCard.tsx` con distancia, estado físico, modo y resaltado de proximidad `< 10 cm`. Verificar: `npx tsc --noEmit` en 0 errores.

7. **Pantalla Dashboard.** Reescribir `src/app/(tabs)/index.tsx`: `useTelemetry()`, `ScrollView`, header con badge, ramas `isLoading`/`isError`/`data`, banners de riego y cuadrícula responsiva de las 4 tarjetas. Verificar: `npx tsc --noEmit` en 0 errores.

8. **Verificación web y nativo.** `npm run web` y `npx expo start -c --android` en Expo Go 58 (Android): Dashboard con datos vivos que cambian cada 2 s, 2 columnas en web y apilado en móvil, sin pantalla en blanco ni errores de consola. Para verificar el estado de error, inyectar temporalmente un `throw` en `mock.service.getTelemetry()`, confirmar la tarjeta + `refetch()`, y revertir.

## Criterios de aceptación

- [ ] `npx tsc --noEmit` termina con 0 errores.
- [ ] `src/app/(tabs)/index.tsx` consume solo `useTelemetry()`; no hay imports de `useSendCommand` ni botones de accionamiento.
- [ ] Durante la carga inicial se muestra un indicador (`ActivityIndicator`) en lugar de las tarjetas.
- [ ] Ante un error de consulta se muestra la tarjeta de aviso y el botón ejecuta `refetch()` (verificado con fallo inyectado temporalmente y luego revertido).
- [ ] El badge muestra `"En vivo • Simulación"` y los datos se actualizan cada 2 s sin interacción del usuario.
- [ ] Con `pumpActive === true` aparece el banner `"Bomba regando…"`.
- [ ] Con `pumpCooldownRemainingSec > 0` aparece el banner `"En espera de seguridad (Ns)"` con los segundos correctos.
- [ ] `ClimateCard` muestra temperatura a 1 decimal (°C), humedad (% HR) y, con `dhtOk === false`, la alerta de fallo con valores retenidos.
- [ ] `SoilMoistureCard` muestra `%`, `soilRaw` (0–4000), barra con marcas de objetivo y umbral, y el estado correcto según la precedencia de `soilStateLabel`.
- [ ] Los porcentajes se muestran redondeados (`roundPercent`) sin artefactos de coma flotante (`64.80000000000001`), tanto en el texto como en el `width` de la barra.
- [ ] Las marcas de objetivo/umbral usan `left` + `translateX: -1` y no se desbordan cuando el objetivo es `100%`.
- [ ] `SensorCard` tipa `icon` como `React.ComponentProps<typeof Ionicons>["name"]` y no como `string` (compila sin errores).
- [ ] `PhotoperiodCard` muestra fase (`Día · Luz activa` / `Noche · Reposo`), cuenta regresiva `HH:MM:SS`, `lightPwm` con porcentaje (0–255 → 0–100 %) y ventilador Encendido/Apagado + `fanPwm`.
- [ ] `AccessGateCard` muestra distancia (cm), `Abierta (45°)`/`Cerrada (0°)`, modo activo y resaltado cuando `proximityDistanceCm < 10`.
- [ ] En web (ancho ≥ 600 px) las tarjetas se disponen en 2 columnas; en móvil (~360 px) se apilan en 1 columna, con `ScrollView` funcional.
- [ ] `npm run web` arranca sin errores y Expo Go 58 (Android) muestra el Dashboard con datos y sin pantalla en blanco.

## Decisiones tomadas y descartadas

- **Sí:** Dashboard de solo lectura con `useTelemetry()`. Las mutaciones (`useSendCommand`) quedan reservadas para `Controls` en SPEC 04, evitando acoplar monitoreo y accionamiento.
- **Sí:** componentes presentacionales que reciben solo los campos que usan (no el `TelemetryDTO` completo), para testearlos y reutilizarlos con facilidad.
- **Sí:** helpers puros de formateo en `src/components/sensors/format.ts` (sin React), separados de los componentes, para mantener la lógica de presentación verificable sin render.
- **Sí:** carcasa compartida `SensorCard` (título + icono Ionicons + contenedor) usada por las 4 tarjetas, para no duplicar estilos de tarjeta.
- **Sí:** responsivo con flexbox (`flexWrap` + `flexGrow` + `flexBasis: 300`) en vez de media queries o `useWindowDimensions`, porque funciona igual en React Native y en web y no añade dependencias.
- **Sí:** etiquetas en español consistentes con las specs previas (`Óptimo`, `Seco / Riego pendiente`, `Regando`, `En espera de seguridad`).
- **Sí:** precedencia explícita en `soilStateLabel` (riego → cooldown → seco → óptimo) para que una misma lectura nunca tenga dos estados a la vez.
- **Sí:** paleta `AppColors` (clara, indigo/lavanda) y `MaxContentWidth = 800` ya existentes; no se introduce ningún sistema de estilos nuevo.
- **Sí:** redondear porcentajes con `roundPercent` en `format.ts` antes de pintarlos. La evaporación del motor (~0.2/s) produce flotantes como `64.80000000000001`; redondear en el límite de presentación evita artefactos sin tocar el motor.
- **Sí:** tipar `icon` con `React.ComponentProps<typeof Ionicons>["name"]` en `SensorCard` para validación estática y autocompletado, en vez de `string`.
- **Sí:** centrar las marcas de la barra con `left` en porcentaje + `transform: [{ translateX: -1 }]`, evitando desbordes cuando el objetivo llega a `100%`.
- **No:** `useWindowDimensions`/media queries para el grid (complejidad innecesaria).
- **No:** gráficas históricas, cliente API o WebSockets; van en specs posteriores.
- **No:** NativeWind ni librería de iconos alternativa (`lucide-react-native`); se mantiene `@expo/vector-icons`.

## Riesgos

| Riesgo                                                  | Mitigación                                                                                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Re-render cada 2 s que parpadee o desmonte las tarjetas | Componentes puramente derivados de `data`; sin animación ni estado local; `refetchInterval` conserva la query.                        |
| La cuenta regresiva salta de 2 en 2 s por el polling    | Aceptado: el `HH:MM:SS` se deriva del snapshot; no se simula tick local para no mentir sobre el estado real.                          |
| Barra de progreso con `width` en % que falle en Android | Usar `width` en porcentaje (string, p. ej. `{ width: pct + '%' }`) y `flexGrow`/`flexBasis` estándar; verificación visual en Expo Go. |
| Estado de error inalcanzable con el mock (nunca falla)  | Rama `isError` cubierta por código; verificar inyectando un `throw` temporal en `getTelemetry()` y revirtiendo.                       |
| `dhtOk === false` confundido con fallo de red           | El fallo del DHT11 es una alerta dentro de `ClimateCard` (valores retenidos), distinta de la tarjeta de error de la query.            |
| Desbordamiento en pantallas muy estrechas               | `ScrollView` vertical + `flexWrap`; los números largos se formatean con 1 decimal y unidades acotadas.                                |

## Qué **no** está en esta spec

- Pantalla `Controls` (sliders PWM, riego manual, selector de modo de compuerta) → **SPEC 04**.
- Pantalla `Settings` (formulario de umbrales y botones de debug del `mockEngine`) → **SPEC 05**.
- Gráficas históricas de sensores.
- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot.
- NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.

Cada uno de esos, si llega, va en su propia spec.
