# SPEC 05 — Pantalla Settings, configuración de umbrales y panel de simulación

> **Estado:** Implementado
> **Fecha:** 2026-11-21
> **Objetivo:** Implementar la pantalla `Settings` (`src/app/(tabs)/settings.tsx`) que consume `useTelemetry()` para leer los umbrales vigentes y el estado del simulador, con tres componentes modulares en `src/components/settings/` (`ThresholdsCard`, `SimulationDebugCard`, `FirmwareRulesCard`), formulario con borrador local que resiste el polling de 2 s, atajos de depuración del `mockEngine` con invalidación inmediata de la telemetría y una referencia de solo lectura de las reglas del firmware, sin tocar los contratos de dominio ni añadir dependencias, dejando `npx tsc --noEmit` en 0 errores y verificando en web y en Expo Go 58 (Android).

## Alcance

**Dentro:**

- Reemplazar el placeholder de `src/app/(tabs)/settings.tsx` por una pantalla que consume `useTelemetry()` para leer `targetMoisturePct`, `hysteresisPct`, `dhtOk`, `photoperiodState`, `proximityDistanceCm` y `soilMoisturePct`.
- Manejar los tres estados de consulta: `isLoading` (`ActivityIndicator` + "Cargando telemetría…"), `isError` (tarjeta de aviso + botón "Reintentar" que ejecuta `refetch()`) y datos vivos con refresco automático cada 2 s.
- Encabezado con badge de telemetría (`"En vivo • Simulación"`) y layout responsivo idéntico a `Dashboard` y `Controls`: `ScrollView` centrado con `MaxContentWidth` y cuadrícula `flexWrap` + `flexBasis: 300` (2 columnas en web, apilado en móvil).
- Tres componentes modulares en `src/components/settings/`: `ThresholdsCard` (formulario `SET_THRESHOLDS`), `SimulationDebugCard` (panel de pruebas del simulador local) y `FirmwareRulesCard` (referencia de solo lectura), con el contenido detallado en la sección de arquitectura.
- `ThresholdsCard`: `TextInput` numéricos, validación en tiempo real de enteros, vista previa del umbral de encendido, botón "Guardar umbrales" y botón "Restaurar cultivo base (65% / 10%)".
- Estrategia de borrador local (`draftTarget: string | null`, `draftHysteresis: string | null`) para que el polling de 2 s no sobrescriba lo que el usuario está tecleando; los borradores se limpian en `onSuccess` de la mutación.
- `SimulationDebugCard`: exponer los 5 helpers de depuración ya existentes en `mockEngine` (`setProximityNear`, `setProximityFar`, `forceSoilDry`, `togglePhotoperiod`, `setSensorFault`) y invalidar `["telemetry"]` tras cada acción para ver el cambio al instante, sin esperar al siguiente tick.
- `FirmwareRulesCard`: resumir con valores derivados de constantes las reglas configuradas en el firmware ESP32 (fotoperiodo 13 h / 11 h, bomba 10 s / 30 s, PWM ventilador 230–245, ultrasónico < 10 cm).
- Reutilizar íntegramente `SensorCard`, `AppColors`, `Spacing`, `BottomTabInset`, `MaxContentWidth` e Ionicons de `@expo/vector-icons`, con controles 100 % JS (`Pressable`, `TextInput`), sin dependencias nativas.

**Fuera de alcance (para specs futuras):**

- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot → **Fase 2**.
- Persistencia en `AsyncStorage`, almacenamiento local entre recargas o sincronización de umbrales con el servidor.
- Instalación de librerías externas adicionales (slider nativo, `lucide-react-native`, etc.).
- Modificación de `greenhouse.types.ts`, `mock.engine.ts`, `mock.service.ts`, `useGreenhouse.ts` ni de la interfaz `GreenhouseRepository`.
- Gráficas históricas, registro de comandos, NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.

## Arquitectura y contratos

Esta spec no introduce estructuras de datos de dominio nuevas. Reutiliza al 100 % los contratos de SPEC 01 (`TelemetryDTO`, `CommandDTO` y las constantes `SOIL`, `PWM`, `PUMP`, `PHOTOPERIOD`, `GATE`) y la capa de estado de SPEC 02 (`useTelemetry`, `useSendCommand`, `queryKey = ["telemetry"]`). No se modifica el motor ni el repositorio: los helpers de depuración ya están exportados por `mock.service.ts` como `engine as mockEngine` y **no forman parte de `GreenhouseRepository`**.

Archivos que aparecen o cambian: se crean `src/components/settings/ThresholdsCard.tsx`, `src/components/settings/SimulationDebugCard.tsx` y `src/components/settings/FirmwareRulesCard.tsx`, y se reescribe `src/app/(tabs)/settings.tsx`. Ningún otro archivo se toca.

Flujo de datos:

```
useTelemetry() → QueryClient → greenhouseRepository.getTelemetry() → TelemetryDTO → las 3 tarjetas
ThresholdsCard → useSendCommand().mutate({ type: "SET_THRESHOLDS", ... }) → invalidateQueries(["telemetry"]) → borradores a null
SimulationDebugCard → mockEngine.<helper>() → queryClient.invalidateQueries({ queryKey: ["telemetry"] }) → refetch inmediato
```

### Carcasa reutilizada

Igual que en SPEC 03 y SPEC 04, cada tarjeta usa `SensorCard` de `@/components/sensors/SensorCard` (props `title`, `icon: React.ComponentProps<typeof Ionicons>["name"]`, `accent?`, `children`, con `flexGrow: 1` y `flexBasis: 300`). No se extrae una base nueva ni se refactorizan las tarjetas existentes. Se usan también los helpers puros de `@/components/sensors/format.ts` que apliquen (`roundPercent` para los porcentajes mostrados).

### Componentes — `src/components/settings/`

Cada componente recibe **solo los campos que necesita** (no el `TelemetryDTO` completo). `ThresholdsCard` llama internamente a `useSendCommand()` para tener su propio `isPending`/`isError`, según la convención de SPEC 04.

```ts
// src/components/settings/ThresholdsCard.tsx
interface ThresholdsCardProps {
  targetMoisturePct: number; // 10..95 en la UI; default 65
  hysteresisPct: number; // 1..target-1 en la UI; default 10
}
```

- **Campos:** dos `TextInput` con `keyboardType="number-pad"`, uno para el objetivo de humedad y otro para la histéresis, con etiquetas "Objetivo de humedad (%)" y "Margen de histéresis (%)". Cada campo muestra debajo su mensaje de validación inline cuando corresponda.
- **Valor pintado:** `draftTarget ?? String(targetMoisturePct)` y `draftHysteresis ?? String(hysteresisPct)`.
- **Reglas de validación** (se recalculan en cada render con los borradores efectivos):
  1. El texto debe ser un entero sin signo: `/^\d+$/`. Se rechazan vacíos, decimales, signos, espacios y notación exponencial.
  2. `targetMoisturePct` debe estar entre `10` y `95` (inclusive).
  3. `hysteresisPct` debe estar entre `1` y `targetMoisturePct - 1` (inclusive), de modo que el umbral de encendido `target - hysteresis` sea siempre `> 0 %` y `< target`.
  4. Mensajes inline: "El objetivo debe ser un entero entre 10 y 95." / "La histéresis debe ser un entero entre 1 y N." (donde `N = target - 1`). Si el objetivo es inválido, la histéresis se valida contra el objetivo vigente en telemetría para no mostrar un límite absurdo.
  5. El motor sigue haciendo _clamp_ a `0..100` y `0..target` como red de seguridad (SPEC 02), pero la UI **nunca** envía un comando inválido.

- **Vista previa:** con valores válidos, mostrar `"La bomba se encenderá debajo de X%"`, donde `X = target - hysteresis` calculado con los borradores efectivos; cuando no hay borradores, muestra el umbral vigente. Opcionalmente, mostrar el umbral vigente entre paréntesis para hacer visible el cambio pendiente.
- **Botón "Guardar umbrales":** deshabilitado si hay errores de validación, si no hay cambios (`parsedTarget === targetMoisturePct && parsedHysteresis === hysteresisPct`), o si `isPending === true`. Despacha `{ type: "SET_THRESHOLDS", targetMoisturePct, hysteresisPct }` vía `useSendCommand()` y limpia ambos borradores en `onSuccess`. Si `isError`, muestra un aviso inline sin borrar lo tecleado.
- **Botón secundario "Restaurar cultivo base (65% / 10%)":** despacha `SET_THRESHOLDS` con `SOIL.DEFAULT_TARGET_PCT` y `SOIL.DEFAULT_HYSTERESIS_PCT`, también vía `useSendCommand()`; deshabilitado mientras `isPending`. Comparte el mismo `onSuccess` de limpieza de borradores.
- La mutación dispone de `onSuccess` propio de la tarjeta, que se suma al `invalidateQueries(["telemetry"])` que `useSendCommand()` ya hace en SPEC 02 (no se duplica la invalidación).

```ts
// src/components/settings/SimulationDebugCard.tsx
interface SimulationDebugCardProps {
  dhtOk: boolean;
  photoperiodState: PhotoperiodState;
  proximityDistanceCm: number;
  soilMoisturePct: number;
}
```

- Etiquetado explícitamente como **"Panel de pruebas · simulador local"** con una nota: "Estos botones afectan solo al `mockEngine` de esta sesión; no envían comandos al invernadero real.". Se importa `mockEngine` desde `@/services/mock/mock.service` y se obtiene `queryClient` con `useQueryClient()` de `@tanstack/react-query`.
- **Proximidad:** botón `"Simular objeto cerca (< 10 cm)"` → `mockEngine.setProximityNear()` (el motor fija `GATE.PROXIMITY_THRESHOLD_CM - 1 = 9 cm`) y botón `"Simular área despejada (≥ 10 cm)"` → `mockEngine.setProximityFar()` (fija `10 + 10 = 20 cm`). Mostrar siempre `proximityDistanceCm` actual (cm) y resaltarlo cuando sea `< GATE.PROXIMITY_THRESHOLD_CM`.
- **Sustrato:** botón `"Forzar suelo seco"` → `mockEngine.forceSoilDry()` (el motor deja la humedad en `target - hysteresis - 1 %`, justo por debajo del umbral). Mostrar `soilMoisturePct` actual y una nota: "Dispara el riego automático; observa el cooldown en Dashboard/Controls.".
- **Fotoperiodo:** botón `"Alternar Día / Noche"` → `mockEngine.togglePhotoperiod()`, indicando la fase actual (`DAY` / `NIGHT`) y su cuenta a través del texto de la tarjeta; el motor reinicia el contador a `PHOTOPERIOD.DAY_HOURS`/`NIGHT_HOURS` y ajusta `fanActive`.
- **Sensor DHT11:** botón/interruptor con etiqueta dinámica: si `dhtOk === true`, `"Simular fallo DHT11"` → `mockEngine.setSensorFault(true)`; si `dhtOk === false`, `"Restaurar sensor DHT11"` → `mockEngine.setSensorFault(false)`. Mostrar el estado actual del sensor.
- **Invalidación:** después de **cada** una de las 5 acciones, llamar `queryClient.invalidateQueries({ queryKey: ["telemetry"] })` (o `refetch()` desde la pantalla) para que la UI refleje el cambio simulado al instante, sin esperar el siguiente tick de 2 s. La clave literal debe coincidir con `TELEMETRY_KEY` en `src/hooks/useGreenhouse.ts`.

```ts
// src/components/settings/FirmwareRulesCard.tsx
// Sin props: tarjeta informativa de solo lectura.
```

- No ejecuta comandos ni accede al `mockEngine`; solo pinta constantes importadas de `@/domain/models/greenhouse.types`, sin números duplicados a mano:
  - Fotoperiodo: `PHOTOPERIOD.DAY_HOURS` h de luz / `PHOTOPERIOD.NIGHT_HOURS` h de oscuridad (13 / 11).
  - Bomba: riego máx. `PUMP.MAX_RUN_SEC` s / espera de seguridad `PUMP.COOLDOWN_SEC` s (10 / 30).
  - Ventilador: PWM `PWM.FAN_MIN`–`PWM.FAN_MAX` (230–245), protección de voltaje del ESP32.
  - Sensor ultrasónico: compuerta automática cuando la distancia es `< GATE.PROXIMITY_THRESHOLD_CM` cm (< 10 cm).
- Iconos Ionicons sugeridos: `sunny-outline`, `water-outline`, `speedometer-outline`, `locate-outline`.

### Borrador de texto vs polling de 2 s

`useTelemetry()` refresca el snapshot cada 2 s. Para que ese refresco no pise lo que el usuario está tecleando, `ThresholdsCard` mantiene dos borradores de **texto**:

- `const [draftTarget, setDraftTarget] = useState<string | null>(null)` y `const [draftHysteresis, setDraftHysteresis] = useState<string | null>(null)`. `null` significa "seguir el valor vivo"; una cadena (incluida `""`) significa "hay una edición en curso".
- `onChangeText` guarda el texto tal cual (`setDraftTarget(text)`), sin parsear ni formatear, para no pelearse con el teclado ni perder el cursor.
- La validación y la vista previa trabajan sobre los borradores efectivos (`draft ?? String(valorVivo)`); el polling nunca los sobrescribe porque `draft` solo lo cambia la interacción del usuario.
- `mutate(command, { onSuccess: () => { setDraftTarget(null); setDraftHysteresis(null); } })`. Tras confirmarse, el siguiente refetch muestra los valores ya aplicados. En `isError` los borradores se conservan.
- Se elige `string | null` (y no `number | null`) porque el `TextInput` produce texto: así se distingue "campo vacío" de "sin edición" y se puede validar `/^\d+$/` antes de convertir con `Number(...)`.

### Estructura de `src/app/(tabs)/settings.tsx`

```
SettingsScreen
  useTelemetry()  → { data, isLoading, isError, refetch }
  <ScrollView> (contentContainer centrado, maxWidth: MaxContentWidth)
    <Header>  (título "Settings" + badge "En vivo • Simulación")
    si isLoading → <ActivityIndicator> centrado
    si isError  → tarjeta de aviso + botón "Reintentar" → refetch()
    si data     → cuadrícula con ThresholdsCard, SimulationDebugCard, FirmwareRulesCard
```

- **Badge:** punto verde (`#22C55E`) + texto `"En vivo • Simulación"` (la fuente es el mock; no hay estado real de conexión).
- **Cuadrícula:** `View` con `flexDirection: 'row'`, `flexWrap: 'wrap'`, `gap: Spacing.three`; cada tarjeta hereda `flexGrow: 1` y `flexBasis: 300` de `SensorCard`. En web da 2 columnas dentro de `MaxContentWidth = 800`; en móvil (~360 px) se apila a 1 columna, sin media queries ni NativeWind.
- `contentContainerStyle` con `paddingBottom: BottomTabInset + Spacing.four`, igual que `Dashboard` y `Controls`, para que la última tarjeta no quede tapada por la barra de tabs.

## Plan de implementación

Cada paso deja la app funcional y arrancable.

1. **`ThresholdsCard`.** Crear `src/components/settings/ThresholdsCard.tsx` con carcasa `SensorCard`, dos `TextInput` numéricos, borradores `string | null`, validación de enteros (objetivo 10–95, histéresis 1–`target - 1`), mensajes inline, vista previa `"La bomba se encenderá debajo de X%"`, botón "Guardar umbrales" (`SET_THRESHOLDS`, deshabilitado si inválido/sin cambios/`isPending`), botón "Restaurar cultivo base (65% / 10%)" con `SOIL.DEFAULT_*`, y limpieza de borradores en `onSuccess`. Verificar: `npx tsc --noEmit` en 0 errores.

2. **`SimulationDebugCard`.** Crear `src/components/settings/SimulationDebugCard.tsx` con el panel etiquetado como pruebas del simulador local, los 5 botones/interruptor que llaman a `mockEngine.setProximityNear`, `setProximityFar`, `forceSoilDry`, `togglePhotoperiod` y `setSensorFault(dhtOk)`, la telemetría actual mostrada y `queryClient.invalidateQueries({ queryKey: ["telemetry"] })` tras cada acción. Verificar: `npx tsc --noEmit` en 0 errores.

3. **`FirmwareRulesCard`.** Crear `src/components/settings/FirmwareRulesCard.tsx` sin props, leyendo `PHOTOPERIOD`, `PUMP`, `PWM` y `GATE` desde el dominio, con las cuatro reglas y sus iconos Ionicons. Verificar: `npx tsc --noEmit` en 0 errores.

4. **Pantalla `Settings`.** Reescribir `src/app/(tabs)/settings.tsx`: `useTelemetry()`, `ScrollView` con `MaxContentWidth` y `BottomTabInset`, header con badge, ramas `isLoading`/`isError`/`data`, y cuadrícula responsiva que pasa a cada tarjeta solo los campos que necesita. Verificar: `npx tsc --noEmit` en 0 errores.

5. **Verificación web, nativa y cruzada.** `npm run web` y `npx expo start -c --android` en Expo Go 58 (Android): comprobar que los umbrales se guardan sin parpadeo por el polling, que las 5 acciones del panel cambian la UI al instante y que el layout es de 2 columnas en web y apilado en móvil. Pruebas cruzadas: tras `forceSoilDry`, Dashboard muestra "Seco / Riego pendiente" → "Regando" y Controls muestra la espera de seguridad (30 s); tras `setProximityNear`, `AccessGateCard` resalta la proximidad y `GateControlCard` muestra < 10 cm; tras `togglePhotoperiod`, cambian `PhotoperiodCard` y el estado del ventilador en `PhotoperiodCard`/`FanControlCard`; tras `setSensorFault(true)`, `ClimateCard` muestra la alerta del DHT11 con valores retenidos. Para verificar la rama de error de la query, inyectar temporalmente un `throw` en `mock.service.getTelemetry()`, confirmar tarjeta + `refetch()`, y revertir. Para el error de mutación, inyectar un fallo temporal en `sendCommand()`, confirmar el aviso inline sin perder los borradores, y revertir.

## Criterios de aceptación

- [x] `npx tsc --noEmit` termina con 0 errores.
- [x] `src/app/(tabs)/settings.tsx` consume `useTelemetry()` y compone las tres tarjetas; no queda el placeholder "En construcción".
- [x] Durante la carga inicial se muestra un `ActivityIndicator` en lugar de las tarjetas.
- [x] Ante un error de consulta se muestra la tarjeta de aviso y el botón ejecuta `refetch()` (verificado con fallo inyectado temporalmente y luego revertido).
- [x] El badge muestra `"En vivo • Simulación"` y los datos se actualizan cada 2 s sin interacción del usuario.
- [x] `ThresholdsCard` pinta `targetMoisturePct` y `hysteresisPct` vigentes mientras no haya borradores, y respeta lo tecleado durante el polling de 2 s.
- [x] Se rechazan valores vacíos, decimales, signos y fuera de rango: objetivo 10–95 e histéresis 1–`target - 1`, con mensaje inline por campo.
- [x] La histéresis nunca puede igualar o superar el objetivo, de modo que el umbral de encendido `target - hysteresis` es siempre `> 0 %` y `< target`.
- [x] La vista previa muestra `"La bomba se encenderá debajo de X%"`, con `X = target - hysteresis`, y se recalcula al teclear.
- [x] "Guardar umbrales" está deshabilitado con valores inválidos, sin cambios o con `isPending`, y despacha exactamente `{ type: "SET_THRESHOLDS", targetMoisturePct, hysteresisPct }`.
- [x] Tras guardar con éxito, los borradores vuelven a `null` y la UI muestra los nuevos valores; si la mutación falla, el aviso es inline y los borradores se conservan (fallo inyectado y revertido).
- [x] "Restaurar cultivo base (65% / 10%)" despacha `SET_THRESHOLDS` con `SOIL.DEFAULT_TARGET_PCT` y `SOIL.DEFAULT_HYSTERESIS_PCT`.
- [x] `SimulationDebugCard` está etiquetado como panel de pruebas del simulador local y expone exactamente los 5 helpers `setProximityNear`, `setProximityFar`, `forceSoilDry`, `togglePhotoperiod` y `setSensorFault(dhtOk)`, importados desde `@/services/mock/mock.service`.
- [x] Tras cualquiera de las 5 acciones se llama `queryClient.invalidateQueries({ queryKey: ["telemetry"] })` y la UI cambia antes del siguiente tick de 2 s.
- [x] El panel muestra la distancia actual (cm) resaltada cuando `< 10 cm`, la humedad actual (%), la fase `DAY`/`NIGHT` y el estado del DHT11, con etiquetas dinámicas "Simular fallo DHT11" / "Restaurar sensor DHT11".
- [x] `FirmwareRulesCard` es de solo lectura y muestra 13 h / 11 h, 10 s / 30 s, PWM 230–245 y umbral ultrasónico < 10 cm usando constantes, sin números duplicados a mano.
- [x] En web (ancho ≥ 600 px) las tarjetas se disponen en 2 columnas; en móvil (~360 px) se apilan en 1 columna, con `ScrollView` funcional y última tarjeta visible sobre la barra de tabs.
- [x] Pruebas cruzadas verificadas en web y en Expo Go 58 (Android): suelo seco → riego/cooldown en Dashboard y Controls; objeto cerca → alerta de proximidad; cambio de fase → ventilador y fotoperiodo; fallo DHT11 → alerta en ClimateCard.
- [x] `npm run web` arranca sin errores y Expo Go 58 (Android) muestra la pantalla Settings sin pantalla en blanco ni errores de consola.
- [x] No se añaden dependencias en `package.json`, no se usa `AsyncStorage`, no se crea `services/api/` ni código STOMP, y no se modifican los contratos de dominio, el motor, el repositorio ni los hooks de SPEC 01–02.

> **Registro de verificación (2026-11-22):** comprobados en este entorno `npx tsc --noEmit` (0 errores), `npm run web -- --port 8082` y la ruta `/settings`, el badge y las tres tarjetas, validación inline y vista previa del formulario, guardado con limpieza de borradores, aviso inline con los borradores conservados ante fallo de mutación inyectado (revertido), tarjeta de error con `Reintentar` ante fallo de query inyectado (revertido), las 5 acciones del panel con invalidación inmediata, las pruebas cruzadas en web (riego, proximidad, fotoperiodo, DHT11) y el layout de 2 columnas a 1000 px / 1 columna a 360 px. La comprobación en Expo Go 58 (Android) fue ejecutada y confirmada por el usuario en dispositivo; no se pudo reproducir en el entorno del agente (sin `adb`), pero con esa confirmación todos los criterios quedan marcados y el estado pasa a `Implementado`.

## Decisiones tomadas y descartadas

- **Sí:** rango de objetivo `10..95` (la primera opción planteada) en vez de `1..100`. Deja margen agronómico y, junto con `hysteresis >= 1`, garantiza que el umbral de encendido sea positivo. El _clamp_ del motor (`0..100` y `0..target`) se conserva como red de seguridad, pero la UI no envía valores que él tendría que corregir.
- **Sí:** validar en la UI aunque el motor ya acote. Un _clamp_ silencioso confundiría al usuario: escribir `150` y ver `100` sin explicación es peor que deshabilitar el botón y mostrar el motivo.
- **Sí:** borradores como `string | null` (y no `number | null`). El `TextInput` entrega texto; mantenerlo tal cual preserva el cursor, permite el campo vacío y hace posible validar enteros con `/^\d+$/` antes de convertir.
- **Sí:** `ThresholdsCard` llama a `useSendCommand()` internamente, igual que las tarjetas de SPEC 04. Así su `isPending`/`isError` no contamina ni depende del panel de simulación.
- **Sí:** limpiar los borradores solo en `onSuccess`. Si el comando falla, conservar lo tecleado evita perder la edición del usuario.
- **Sí:** invalidar con la clave literal `["telemetry"]` desde `SimulationDebugCard`, sin exportar `TELEMETRY_KEY` ni modificar `useGreenhouse.ts`. Mantiene el alcance de archivos reducido y cumple lo pedido; el acoplamiento se vigila con el criterio de aceptación de refresco inmediato.
- **Sí:** importar `mockEngine` desde `@/services/mock/mock.service`, que ya lo reexporta. No se añade un nuevo módulo de debug ni se toca `GreenhouseRepository`: los helpers son solo de la sesión local.
- **Sí (corrección durante la implementación):** el botón del DHT11 llama a `mockEngine.setSensorFault(dhtOk)`, no a `setSensorFault(!dhtOk)`. `mock.engine.ts` define `setSensorFault(fault) { this.state.dhtOk = !fault; }`, por lo que negar el argumento lo deja intacto (`!(!dhtOk) === dhtOk`) y el botón sería un no-op. Pasar `dhtOk` respeta la semántica del motor y la arquitectura de esta spec (línea 88: `dhtOk === true` → fallo, `dhtOk === false` → restaurar), y se comprobó en navegador que cambia `OK` ↔ `En fallo` y propaga la alerta a `ClimateCard`. Se corrigen aquí el plan y el criterio de aceptación para que no contradigan la arquitectura; el motor no se toca.
- **Sí:** `FirmwareRulesCard` lee las constantes del dominio en lugar de escribir los números a mano, para que un cambio de firmware se refleje desde un único sitio.
- **Sí:** etiquetas en español y paleta `AppColors` (clara, indigo/lavanda), coherentes con SPEC 03 y SPEC 04.
- **Sí:** el panel de simulación avisa de que sus acciones no llegan al invernadero real, para no confundirlo con los comandos `CommandDTO` de `Controls`.
- **No:** `AsyncStorage` ni ninguna persistencia. Los umbrales vuelven a los valores por defecto al recargar; es aceptable en un simulador local de Fase 1 y evita un mecanismo de migración de esquema.
- **No:** backend Spring Boot, WebSockets STOMP ni `services/api/`; pertenecen a la Fase 2.
- **No:** librerías externas, slider nativo, NativeWind, gráficas, pruebas unitarias, CI ni `eas.json`.
- **No:** reorganizar `SensorCard` ni los componentes de sensores/actuadores; se reutilizan tal como están.

## Riesgos

| Riesgo                                                                                            | Mitigación                                                                                                                                             |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| El polling de 2 s sobrescribe el texto mientras el usuario teclea                                 | Borradores `string                                                                                                                                     | null`que solo cambia`onChangeText`; el valor pintado es `draft ?? String(valorVivo)`y se limpia en`onSuccess`. |
| Un valor decimal, negativo o vacío llega al `TextInput` y el motor lo corrige en silencio         | Validación `/^\d+$/` + rangos 10–95 y 1–`target - 1`, mensaje inline y botón deshabilitado; el _clamp_ del motor queda solo como red de seguridad.     |
| Desincronización entre la clave literal `["telemetry"]` y `TELEMETRY_KEY` en `useGreenhouse.ts`   | Criterio de aceptación que exige refresco inmediato tras las 5 acciones; si algún día cambia la clave, actualizar ambos puntos en el mismo cambio.     |
| `forceSoilDry` dispare el riego automático de inmediato y parezca un efecto inesperado            | Texto explicativo en la tarjeta y prueba cruzada en Dashboard/Controls: es el comportamiento previsto del motor (humedad = umbral − 1).                |
| Mutaciones simultáneas (guardar umbrales + acciones del panel) con latencia simulada de 50–100 ms | Botones deshabilitados con `isPending` en cada tarjeta; latencia corta y acciones humanas no simultáneas en la práctica.                               |
| `dhtOk === false` se confunda con un error de la query                                            | El fallo del DHT11 se muestra dentro de `SimulationDebugCard` (y en `ClimateCard` con valores retenidos), distinto de la tarjeta de error de consulta. |
| La rama `isError` de la query es inalcanzable con el mock                                         | Cubierta por código; verificación inyectando un `throw` temporal en `getTelemetry()` y revirtiendo.                                                    |
| `flexBasis: 300` desalinea las tarjetas en pantallas intermedias                                  | Mismo patrón ya validado en SPEC 03/04: `flexGrow: 1` + `flexWrap` centrado con `MaxContentWidth`; revisión visual en web y Expo Go.                   |

## Qué **no** está en esta spec

- Cliente API real (`services/api/`) y WebSockets STOMP hacia Spring Boot → **Fase 2**.
- Persistencia de umbrales en `AsyncStorage` o cualquier almacenamiento entre recargas.
- Instalación de librerías externas adicionales.
- Modificación de los contratos de dominio, del motor mock, del repositorio o de los hooks existentes.
- Gráficas históricas, registro de comandos, NativeWind / sistema de estilos definitivo.
- Pruebas unitarias, CI o `eas.json`.

Cada uno de esos, si llega, va en su propia spec.
