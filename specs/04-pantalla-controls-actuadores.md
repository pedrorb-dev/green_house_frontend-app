# SPEC 04 — Pantalla Controls y control de actuadores

> **Estado:** Aprobado
> **Fecha:** 2026-11-21
> **Objetivo:** Implementar la pantalla `Controls` (`src/app/(tabs)/controls.tsx`) que consume `useTelemetry()` para reflejar el estado real de los actuadores y `useSendCommand()` para despachar comandos, con cuatro componentes modulares en `src/components/actuators/` (`PumpControlCard`, `FanControlCard`, `LightControlCard`, `GateControlCard`), manejo explícito de los estados de carga/error/mutación y una estrategia de borrador local que evita que el polling de 2 s pise los valores PWM mientras se ajustan, sin dependencias nativas externas, dejando `npx tsc --noEmit` en 0 errores y verificando en web y en Expo Go 58 (Android).

## Alcance

**Dentro:**

- Reemplazar el placeholder de `src/app/(tabs)/controls.tsx` por una pantalla de control que consume `useTelemetry()` (estado real de actuadores y bloqueos de seguridad) y compone las cuatro tarjetas que despachan comandos vía `useSendCommand()`.
- Manejar los tres estados de consulta: `isLoading` (indicador de carga), `isError` (tarjeta de aviso + botón para `refetch()`) y datos vivos que se refrescan cada 2 s.
- Retroalimentación de mutación: `isPending` (deshabilitar el control activo + indicador de "aplicando") y `mutation.isError` (aviso inline por tarjeta, sin perder el valor en borrador).
- Encabezado con badge de telemetría (`"En vivo • Simulación"`) y layout responsivo idéntico al Dashboard: `ScrollView` centrado con `MaxContentWidth` y cuadrícula `flexWrap` + `flexBasis: 300` (2 columnas en web, apilado en móvil).
- Cuatro componentes modulares en `src/components/actuators/`: `PumpControlCard` (`WATER_PUMP`), `FanControlCard` (`SET_FAN_PWM`), `LightControlCard` (`SET_LIGHT_PWM`) y `GateControlCard` (`SET_GATE_MODE`), con el contenido especificado en la sección de arquitectura.
- Reutilizar la carcasa `SensorCard` y los helpers `lightPwmToPercent`, `formatGateOpen`, `formatGateMode` y `roundPercent` de `src/components/sensors/format.ts`.
- Controles táctiles multiplataforma (botones paso a paso, presets rápidos y botón "Aplicar") implementados con `Pressable`, sin dependencias nativas externas.

**Fuera de alcance (para specs futuras):**

- Formulario de umbrales (`SET_THRESHOLDS`) y botones de debug del `mockEngine` → **SPEC 05**.
- Instalación de `@react-native-community/slider` u otras dependencias nativas externas.
- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot.
- Gráficas históricas de actuadores o registro de comandos.
- NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.

## Arquitectura y contratos

Esta spec no introduce estructuras de datos de dominio nuevas: reutiliza íntegramente los contratos de SPEC 01 (`TelemetryDTO`, `CommandDTO`, `GateMode`, `PWM`, `PUMP`, `GATE`) y la capa de estado de SPEC 02 (`useTelemetry`, `useSendCommand`). No se modifica el motor ni el repositorio. Las únicas constantes nuevas son de UI (paso de foco y presets) y viven como `const` locales en cada componente, sin tocar `greenhouse.types.ts`.

Flujo: `useTelemetry()` → `QueryClient` → `greenhouseRepository.getTelemetry()` → `TelemetryDTO` → tarjetas; y cada tarjeta → `useSendCommand().mutate(CommandDTO)` → `greenhouseRepository.sendCommand()` → `invalidateQueries(["telemetry"])` → refresco.

### Carcasa y helpers reutilizados

- **Carcasa:** cada tarjeta reutiliza `SensorCard` de `@/components/sensors/SensorCard` (props `title`, `icon`, `accent?`, `children`). No se extrae una base nueva ni se refactorizan las tarjetas de SPEC 03.
- **Helpers de `@/components/sensors/format.ts`:** `lightPwmToPercent`, `formatGateOpen`, `formatGateMode`, `formatPhotoperiod` y `roundPercent`.

### Estrategia de estado local vs polling de 2 s

`useTelemetry()` refresca el snapshot cada 2 s. Para que ese refresco no pise el valor que el usuario está ajustando, las tarjetas PWM (`FanControlCard`, `LightControlCard`) mantienen un **borrador local**:

- `const [draft, setDraft] = useState<number | null>(null)`. `null` significa "seguir el valor vivo"; un número significa "hay un cambio pendiente".
- El valor que se pinta es `draft ?? data.value`. El polling nunca sobrescribe el borrador porque `draft` solo lo cambia la interacción del usuario.
- Cada paso/preset hace `setDraft(clamp(nuevoValor, min, max))`.
- El botón "Aplicar" está deshabilitado si `draft === null` (nada que aplicar) o `isPending`. Al pulsarlo se llama `mutate(command, { onSuccess: () => setDraft(null) })`, con lo que el borrador se limpia tras confirmarse y el siguiente refetch muestra el valor vivo aplicado.
- Es seguro porque `fanPwm`, `lightPwm` y `gateMode` solo los cambian los propios comandos del usuario; el tick del motor cambia `fanActive` con el fotoperiodo pero nunca `fanPwm`.

`GateControlCard` es un selector discreto, sin borrador: la selección despacha el comando de inmediato y el selector queda deshabilitado mientras `isPending`.

### Componentes — `src/components/actuators/`

Cada componente recibe **solo los campos que necesita** (no el `TelemetryDTO` completo) y llama internamente a `useSendCommand()` para tener su propio `mutate`/`isPending`/`isError`, independiente del resto de tarjetas.

```ts
// src/components/actuators/PumpControlCard.tsx
interface PumpControlCardProps {
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
  soilMoisturePct: number;
  targetMoisturePct: number;
}
```

- Estado de la bomba con precedencia: `pumpActive === true` → `"Regando…"`; `pumpCooldownRemainingSec > 0` → `"En espera de seguridad (Ns)"` con los segundos restantes; en otro caso → `"Lista para regar"`.
- Humedad actual vs objetivo: `roundPercent(soilMoisturePct)`% frente a `roundPercent(targetMoisturePct)`%.
- Nota de seguridad: `PUMP.MAX_RUN_SEC = 10s` de riego máximo y `PUMP.COOLDOWN_SEC = 30s` de espera.
- Botón `"Regar ahora"` que despacha `{ type: "WATER_PUMP" }`, deshabilitado estrictamente cuando `pumpActive === true`, `pumpCooldownRemainingSec > 0` o `isPending === true`.

```ts
// src/components/actuators/FanControlCard.tsx
interface FanControlCardProps {
  fanActive: boolean;
  fanPwm: number;
  photoperiodState: PhotoperiodState;
}
```

- Rango estrictamente acotado entre `PWM.FAN_MIN` (230) y `PWM.FAN_MAX` (245); cualquier valor fuera de rango se recorta en la UI (y el motor vuelve a hacer _clamp_).
- Nota técnica breve: protección de voltaje del ESP32 (`< 250`).
- Estado: con `fanActive === true` muestra `"Encendido"` (fase `DAY`); en `NIGHT` muestra `"En reposo nocturno"` y aclara que el valor PWM queda guardado para el ciclo diurno (usa `photoperiodState` para el contexto).
- Controles: botones paso a paso `-1` / `+1`, presets rápidos `230`, `238`, `245` y botón `"Aplicar"` (borrador local + `SET_FAN_PWM`). Constante local `FAN_PRESETS = [230, 238, 245]`.

```ts
// src/components/actuators/LightControlCard.tsx
interface LightControlCardProps {
  lightPwm: number;
  photoperiodState: PhotoperiodState;
}
```

- Rango `PWM.LIGHT_MIN` (0) a `PWM.LIGHT_MAX` (255), mostrando tanto el valor PWM crudo como su porcentaje `lightPwmToPercent(lightPwm)`.
- Fotoperiodo actual vía `formatPhotoperiod(photoperiodState)`.
- Controles: botones `-16` / `+16` (constante local `FOCO_PASO = 16`, alineada al firmware ESP32), presets rápidos `0%` (0), `25%` (64), `50%` (128), `100%` (255) y botón `"Aplicar"` (borrador local + `SET_LIGHT_PWM`).

```ts
// src/components/actuators/GateControlCard.tsx
interface GateControlCardProps {
  gateMode: GateMode;
  gateOpen: boolean;
  proximityDistanceCm: number;
}
```

- Selector segmentado de 3 opciones (`AUTO`, `OPEN`, `CLOSED`) con la opción activa claramente resaltada; la selección despacha `{ type: "SET_GATE_MODE", value: mode }` de inmediato y se deshabilita mientras `isPending`.
- Estado físico actual: `formatGateOpen(gateOpen)` (`Abierta (45°)` / `Cerrada (0°)`).
- Distancia del sensor ultrasónico `proximityDistanceCm` (cm), destacada cuando `gateMode === "AUTO" && proximityDistanceCm < GATE.PROXIMITY_THRESHOLD_CM` (10 cm).

### Estructura de `src/app/(tabs)/controls.tsx`

```
ControlsScreen
  useTelemetry()  → { data, isLoading, isError, refetch }
  <ScrollView> (contentContainer centrado, maxWidth: MaxContentWidth)
    <Header>  (título "Controls" + badge "En vivo • Simulación")
    si isLoading → <ActivityIndicator> centrado
    si isError  → tarjeta de aviso + botón "Reintentar" → refetch()
    si data     → cuadrícula de las 4 tarjetas de actuador
```

- **Badge:** punto verde + texto `"En vivo • Simulación"` (la fuente es el mock; no hay estado real de conexión).
- **Cuadrícula:** contenedor `View` con `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: Spacing.three`; cada tarjeta con `flexGrow: 1` y `flexBasis: 300` (heredado de `SensorCard`). En web da 2 columnas; en móvil se apila a 1 columna, sin media queries ni NativeWind.

## Plan de implementación

Cada paso deja la app funcional y arrancable.

1. **`PumpControlCard`.** Crear `src/components/actuators/PumpControlCard.tsx` con la carcasa `SensorCard`, el estado de la bomba (3 ramas con precedencia), humedad vs objetivo, nota de seguridad (`PUMP.MAX_RUN_SEC`/`PUMP.COOLDOWN_SEC`), y el botón `"Regar ahora"` deshabilitado con `pumpActive || pumpCooldownRemainingSec > 0 || isPending`, despachando `WATER_PUMP` vía `useSendCommand()`. Verificar: `npx tsc --noEmit` en 0 errores.

2. **`FanControlCard`.** Crear `src/components/actuators/FanControlCard.tsx` con borrador local (`useState<number | null>`), botones `-1`/`+1`, presets `230`/`238`/`245`, botón `"Aplicar"` (`SET_FAN_PWM` con _clamp_ a 230–245 y `onSuccess` limpiando el borrador), estado `fanActive`/`photoperiodState` y nota de protección de voltaje `< 250`. Verificar: `npx tsc --noEmit` en 0 errores.

3. **`LightControlCard`.** Crear `src/components/actuators/LightControlCard.tsx` con borrador local, botones `-16`/`+16` (`FOCO_PASO = 16`), presets `0%`/`25%`/`50%`/`100%` (0/64/128/255), botón `"Aplicar"` (`SET_LIGHT_PWM` con _clamp_ a 0–255), valor crudo + porcentaje (`lightPwmToPercent`) y `formatPhotoperiod`. Verificar: `npx tsc --noEmit` en 0 errores.

4. **`GateControlCard`.** Crear `src/components/actuators/GateControlCard.tsx` con selector segmentado `AUTO`/`OPEN`/`CLOSED` (activo resaltado), estado físico `formatGateOpen`, distancia `proximityDistanceCm` destacada en `AUTO` con `< 10 cm`, y despacho inmediato de `SET_GATE_MODE` deshabilitado mientras `isPending`. Verificar: `npx tsc --noEmit` en 0 errores.

5. **Pantalla `Controls`.** Reescribir `src/app/(tabs)/controls.tsx`: `useTelemetry()`, `ScrollView` con `MaxContentWidth`, header con badge, ramas `isLoading`/`isError`/`data`, y cuadrícula responsiva de las 4 tarjetas pasando los campos de telemetría que cada una necesita. Verificar: `npx tsc --noEmit` en 0 errores.

6. **Verificación web y nativo.** `npm run web` y `npx expo start -c --android` en Expo Go 58 (Android): pantalla Controls con datos vivos, botones que despachan comandos sin parpadeo por el polling, 2 columnas en web y apilado en móvil, sin pantalla en blanco ni errores de consola. Para verificar la rama de error de la query, inyectar temporalmente un `throw` en `mock.service.getTelemetry()`, confirmar la tarjeta + `refetch()`, y revertir.

## Criterios de aceptación

- [ ] `npx tsc --noEmit` termina con 0 errores.
- [ ] `src/app/(tabs)/controls.tsx` consume `useTelemetry()` y compone las cuatro tarjetas de actuador; no quedan imports de `useSendCommand` en la pantalla (el despacho vive en cada tarjeta).
- [ ] Durante la carga inicial se muestra un indicador (`ActivityIndicator`) en lugar de las tarjetas.
- [ ] Ante un error de consulta se muestra la tarjeta de aviso y el botón ejecuta `refetch()` (verificado con fallo inyectado temporalmente y luego revertido).
- [ ] El badge muestra `"En vivo • Simulación"` y los datos se actualizan cada 2 s sin interacción del usuario.
- [ ] `PumpControlCard` muestra `"Regando…"`, `"En espera de seguridad (Ns)"` (con segundos correctos) o `"Lista para regar"` según la precedencia, la humedad vs objetivo y la nota de seguridad `10s`/`30s`.
- [ ] El botón `"Regar ahora"` está deshabilitado cuando `pumpActive === true`, `pumpCooldownRemainingSec > 0` o `isPending === true`, y despacha `WATER_PUMP` solo cuando corresponde.
- [ ] `FanControlCard` acota el valor a 230–245, muestra la nota de protección `< 250`, el estado `Encendido`/`En reposo nocturno` (con el aviso de PWM guardado para el día) y ofrece `-1`/`+1`, presets `230`/`238`/`245` y `"Aplicar"`.
- [ ] `LightControlCard` acota el valor a 0–255, muestra PWM crudo y porcentaje (`lightPwmToPercent`), el fotoperiodo, botones `-16`/`+16` (`FOCO_PASO = 16`), presets `0%`/`25%`/`50%`/`100%` y `"Aplicar"`.
- [ ] Mientras un valor PWM está en borrador, el polling de 2 s no lo sobrescribe: el valor pintado es `draft ?? data.value` y solo cambia con interacción del usuario o tras aplicar.
- [ ] El botón `"Aplicar"` de las tarjetas PWM está deshabilitado con `draft === null` o `isPending`, y limpia el borrador en `onSuccess`.
- [ ] Un fallo de mutación (`mutation.isError`) muestra un aviso inline en la tarjeta sin perder el valor en borrador (verificado inyectando un fallo temporal en `sendCommand` y revirtiendo).
- [ ] `GateControlCard` muestra el selector segmentado `AUTO`/`OPEN`/`CLOSED` con la opción activa resaltada, el estado físico `Abierta (45°)`/`Cerrada (0°)` y la distancia destacada en `AUTO` cuando `proximityDistanceCm < 10`.
- [ ] En web (ancho ≥ 600 px) las tarjetas se disponen en 2 columnas; en móvil (~360 px) se apilan en 1 columna, con `ScrollView` funcional.
- [ ] `npm run web` arranca sin errores y Expo Go 58 (Android) muestra la pantalla Controls con controles táctiles funcionales y sin pantalla en blanco.
- [ ] No se añaden dependencias nativas externas (ni `@react-native-community/slider` ni similar) en `package.json`.

## Decisiones tomadas y descartadas

- **Sí:** cada tarjeta de actuador llama a `useSendCommand()` internamente, en lugar de una mutación única compartida en la pantalla. Cada comando es una acción independiente y así cada tarjeta tiene su propio `isPending`/`isError` sin contaminarse por la acción de otra.
- **Sí:** borrador local con `useState<number | null>` para los PWM. El `null` significa "seguir el valor vivo"; evita que el polling de 2 s pise el valor mientras el usuario ajusta, sin necesidad de cancelar la query ni de mutar el estado compartido.
- **Sí:** aplicar con botón `"Aplicar"` (no despacho automático en cada paso). El motor tiene latencia simulada de 50–100 ms y el despacho en cada pulsación de `+1`/`-1` generaría ráfagas de comandos y parpadeos; aplicar una vez es más simple y predecible.
- **Sí:** `GateControlCard` despacha de inmediato (sin "Aplicar"), porque es un selector discreto de 3 valores, no un rango continuo; el estado `isPending` deshabilita el selector mientras vuela.
- **Sí:** reutilizar `SensorCard` directamente desde `@/components/sensors/SensorCard` (con su `flexBasis: 300`/`flexGrow: 1`) en vez de extraer una base neutra. Extraerla obligaría a refactorizar las 4 tarjetas de SPEC 03 sin ganancia funcional; se difiere.
- **Sí:** constantes de UI (`FOCO_PASO = 16`, `FAN_PRESETS = [230, 238, 245]`, presets de luz) como `const` locales en cada componente, no en `greenhouse.types.ts`, para respetar al 100% los contratos de dominio de SPEC 01.
- **Sí:** controles con `Pressable` y botones paso a paso/presets en vez de un slider. Un slider nativo (`@react-native-community/slider`) exige development build y rompe Expo Go 58; los botones son 100% JS, multiplataforma y alineados a los pasos del firmware.
- **Sí:** etiquetas en español consistentes con las specs previas (`Regando…`, `En espera de seguridad`, `Lista para regar`, `Abierta (45°)`, `Cerrada (0°)`).
- **Sí:** paleta `AppColors` (clara, indigo/lavanda) y `MaxContentWidth = 800` ya existentes; no se introduce ningún sistema de estilos nuevo.
- **No:** formulario de umbrales y debug del `mockEngine` en esta pantalla; van en Settings (SPEC 05).
- **No:** slider nativo ni `lucide-react-native`; se mantiene `@expo/vector-icons` y `Pressable`.
- **No:** cliente API o WebSockets STOMP; van en specs posteriores.

## Riesgos

| Riesgo                                                                         | Mitigación                                                                                                                             |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- | --- | ---------------------------- | --- | ---------------------------------------------------------------- |
| El polling de 2 s sobrescribe el valor PWM mientras el usuario lo ajusta       | Borrador local `draft ?? data.value`; `draft` solo lo cambia la interacción del usuario y se limpia en `onSuccess`.                    |
| Doble envío de `WATER_PUMP` o envío durante cooldown                           | Botón deshabilitado con `pumpActive                                                                                                    |     | pumpCooldownRemainingSec > 0 |     | isPending`; el motor además ignora riegos en cooldown (SPEC 02). |
| Desbordamiento de rango en los pasos/presets                                   | _Clamp_ en la UI (`clamp(nuevoValor, min, max)`) además del _clamp_ del motor; `-1` en 230 o `+1` en 245 no produce valores inválidos. |
| Estado de error de la query inalcanzable con el mock (nunca falla)             | Rama `isError` cubierta por código; verificar inyectando un `throw` temporal en `getTelemetry()` y revirtiendo.                        |
| Estado de error de la mutación inalcanzable con el mock                        | Aviso inline por tarjeta cubierto por código; verificar inyectando un fallo temporal en `sendCommand()` y revirtiendo.                 |
| Cuatro instancias de `useSendCommand()` que invaliden `["telemetry"]` a la vez | La invalidación es idempotente (una sola refetch tras asentarse el comando); latencia corta y acciones no simultáneas en la práctica.  |
| `flexBasis: 300` de `SensorCard` desalinea las tarjetas en pantallas anchas    | Mismo patrón validado en SPEC 03; `flexGrow: 1` + `flexWrap` centrado con `MaxContentWidth`, verificación visual en web y Expo Go.     |

## Qué **no** está en esta spec

- Formulario de umbrales (`SET_THRESHOLDS`) y botones de debug del `mockEngine` → **SPEC 05**.
- Instalación de `@react-native-community/slider` u otras dependencias nativas externas.
- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot.
- Gráficas históricas de actuadores o registro de comandos.
- NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.

Cada uno de esos, si llega, va en su propia spec.
