# SPEC 01 — Estructura base del proyecto

> **Estado:** Implementado
> **Fecha:** 2026-11-21
> **Objetivo:** Establecer la estructura base del proyecto — dominio, servicios, componentes y rutas `(tabs)` — con los contratos `TelemetryDTO`, `CommandDTO`, constantes y `GreenhouseRepository` definidos, una barra de tabs JS con iconos Ionicons y paleta indigo/lavanda, y dejar la app compilando sin errores de tipos con tres pantallas placeholder visibles en web y en Expo Go 58 (Android).

## Alcance

**Dentro:**

- Crear el árbol de carpetas objetivo (`domain`, `services`, `components`, `hooks`) con sus subcarpetas.
- Definir los contratos de dominio derivados del `README.md`: `TelemetryDTO`, `CommandDTO`, constantes y la interfaz `GreenhouseRepository`.
- Reemplazar las rutas del starter (`index`/`explore`) por el grupo `(tabs)` con 3 pantallas placeholder: `index` (Dashboard), `controls`, `settings`.
- Barra de tabs única con `Tabs` de `expo-router` (JavaScript, sin twin web), con iconos Ionicons `home` / `options` / `settings` (outline → filled según pestaña activa).
- Instalar `@expo/vector-icons` como dependencia directa (`npx expo install @expo/vector-icons`).
- Aplicar la paleta indigo `#4F46E5` + lavanda `#EEF2FF` en tema, splash overlay, `app.json` y pantallas placeholder.
- Extraer `AnimatedSplashOverlay` a `components/ui/` y eliminar el logo demo `AnimatedIcon`.
- Eliminar los componentes, hooks y assets de demo del starter que queden huérfanos.
- Dejar `npx tsc --noEmit` en 0 errores (hoy falla con 3 errores de plantilla).
- Verificar que la app se ve en Expo Go 58 (Android), además de web.

**Fuera de alcance (para specs futuras):**

- Motor de simulación mock (`services/mock/mock.engine.ts` y `mock.service.ts`).
- Cliente API real (`services/api/`) y WebSockets STOMP.
- Pantallas con datos reales: tarjetas de sensores, sliders PWM, botón de riego, selector de compuerta.
- TanStack Query y `hooks/useGreenhouse.ts`.
- NativeWind / sistema de estilos definitivo.
- Barra nativa (`NativeTabs`) ni twin web (`_layout.web.tsx`): descartados en esta enmienda por compatibilidad con Expo Go.

## Modelo de datos

```ts
// src/domain/models/greenhouse.types.ts

export type PhotoperiodState = "DAY" | "NIGHT";
export type GateMode = "AUTO" | "OPEN" | "CLOSED";

export interface TelemetryDTO {
  // DHT11
  temperatureC: number;
  humidityPct: number;
  dhtOk: boolean;
  // Suelo capacitivo
  soilMoisturePct: number; // 0..100 calibrado
  soilRaw: number; // 0..4000 ADC
  // Fotoperiodo
  photoperiodState: PhotoperiodState;
  secondsToPhotoperiodChange: number;
  // Proximidad + compuerta (HC-SR04 + Servo)
  proximityDistanceCm: number;
  gateMode: GateMode;
  gateOpen: boolean; // true = Abierta 45°, false = Cerrada 0°
  // Actuadores
  fanActive: boolean; // true en DAY, false en NIGHT
  fanPwm: number; // 230..245 (velocidad configurada)
  lightPwm: number; // 0..255
  pumpActive: boolean;
  pumpCooldownRemainingSec: number;
  // Umbrales configurables
  targetMoisturePct: number; // 65
  hysteresisPct: number; // 10 (enciende por debajo de 65 - 10 = 55%)
}

export type CommandDTO =
  | { type: "SET_FAN_PWM"; value: number }
  | { type: "SET_LIGHT_PWM"; value: number }
  | { type: "SET_GATE_MODE"; value: GateMode }
  | { type: "WATER_PUMP" }
  | {
      type: "SET_THRESHOLDS";
      targetMoisturePct: number;
      hysteresisPct: number;
    };

export const PWM = {
  FAN_MIN: 230,
  FAN_MAX: 245,
  LIGHT_MIN: 0,
  LIGHT_MAX: 255,
} as const;
export const PUMP = { COOLDOWN_SEC: 30, MAX_RUN_SEC: 10 } as const;
export const SOIL = {
  RAW_DRY: 4000,
  RAW_WET: 0,
  DEFAULT_TARGET_PCT: 65,
  DEFAULT_HYSTERESIS_PCT: 10,
} as const;
export const PHOTOPERIOD = { DAY_HOURS: 13, NIGHT_HOURS: 11 } as const;
export const GATE = {
  PROXIMITY_THRESHOLD_CM: 10,
  OPEN_ANGLE_DEG: 45,
  CLOSED_ANGLE_DEG: 0,
} as const;
```

```ts
// src/domain/repositories/greenhouse.repo.ts

import type {
  CommandDTO,
  TelemetryDTO,
} from "@/domain/models/greenhouse.types";

export interface GreenhouseRepository {
  getTelemetry(): Promise<TelemetryDTO>;
  sendCommand(command: CommandDTO): Promise<void>;
}
```

## Plan de implementación

Cada paso deja la app funcional y arrancable.

1. **Capa de dominio + árbol de carpetas.** Verificar en `tsconfig.json` que `"@/*"` apunte a `["./src/*"]`. Crear `domain/models/greenhouse.types.ts` y `domain/repositories/greenhouse.repo.ts` con el contenido anterior. Crear las carpetas vacías con `.gitkeep`: `components/sensors/`, `components/actuators/`, `services/mock/`, `services/api/`, `hooks/`. Verificar: `npx tsc --noEmit` sigue con los mismos 3 errores conocidos; la app arranca igual.

2. **Extraer splash overlay.** Crear `components/ui/splash-overlay.tsx` (copia de `AnimatedSplashOverlay`) y `splash-overlay.web.tsx` (retorna `null`). Actualizar `src/app/_layout.tsx` para importarlo desde ahí. Eliminar `animated-icon.tsx`, `animated-icon.web.tsx`, `animated-icon.module.css` y el asset `logo-glow.png`. Verificar: el splash se anima y desaparece en web y nativo.

3. **Mover rutas a `(tabs)` con barra JS.** Instalar `@expo/vector-icons` (`npx expo install @expo/vector-icons`). Crear `src/app/(tabs)/_layout.tsx` con `Tabs` de `expo-router` (no `NativeTabs`): `index` → "Dashboard" + `home`/`home-outline`, `controls` → "Controls" + `options`/`options-outline`, `settings` → "Settings" + `settings`/`settings-outline`; color activo indigo e inactivo apagado, `tabBarStyle` lavanda y header acorde. **No crear** `_layout.web.tsx`. Crear `index.tsx`, `controls.tsx`, `settings.tsx` (título + "En construcción"). Eliminar `src/app/index.tsx`, `src/app/explore.tsx`, `components/app-tabs.tsx` y `app-tabs.web.tsx`. Actualizar `src/app/_layout.tsx` para renderizar `<Slot />` (ThemeProvider + splash overlay + Slot). Verificar: 3 pestañas navegables con iconos en web.

4. **Limpiar demo.** Eliminar `components/themed-text.tsx`, `themed-view.tsx`, `hint-row.tsx`, `external-link.tsx`, `web-badge.tsx`, `components/ui/collapsible.tsx`, `hooks/use-theme.ts`, `hooks/use-color-scheme.ts` y `.web.ts`, y los assets demo (`react-logo*`, `expo-badge*`, `tutorial-web.png`, `tabIcons/*`). Conservar los assets referenciados por `app.json` (`icon.png`, `splash-icon.png`, `favicon.png`, `android-icon-*`) y `expo-logo.png` (usado por el splash). Verificar: la app arranca sin referencias rotas.

5. **Cerrar typecheck.** Crear `src/global.d.ts` con `declare module '*.css';` y `declare module '*.module.css';` (mantiene `import '@/global.css'` de `theme.ts` sin tocarlo). Verificar: `npx tsc --noEmit` termina con 0 errores.

6. **Aplicar tema visual.** Extender `Colors` en `src/constants/theme.ts` con `primary` (`#4F46E5`), `onPrimary` (`#FFFFFF`) y fondos (`#EEF2FF` en light; indigo oscuro en dark). Pintar el fondo de `src/components/ui/splash-overlay.tsx` de indigo; actualizar `app.json` (`expo-splash-screen.backgroundColor` → `#4F46E5`, `android.adaptiveIcon.backgroundColor` → `#EEF2FF`) y las 3 pantallas placeholder (fondo lavanda, título indigo, texto secundario). Actualizar `AGENTS.md` para reflejar que la barra es JS y que `@expo/vector-icons` es dependencia directa. Verificar: `npx tsc --noEmit` sigue en 0 errores y web muestra la paleta.

7. **Verificar web y Expo Go.** `npm run web` → rutas `/`, `/controls`, `/settings` con iconos y sin errores. `npx expo start -c --android` (caché limpia) → abrir QR con Expo Go 58 en Android: splash indigo, 3 pestañas con iconos sobre lavanda, sin pantalla en blanco. Si aparece pantalla en blanco, revisar logs de Metro antes de dar por cerrada la spec.

## Criterios de aceptación

- [x] `npx tsc --noEmit` termina con 0 errores.
- [x] `npm run web` arranca y muestra 3 pestañas (Dashboard, Controls, Settings) con iconos Ionicons (HTTP 200 en `/`, `/controls`, `/settings`).
- [x] Navegar entre las 3 pestañas funciona en web y la app no se cuelga en el splash.
- [x] En Expo Go 58 (Android) el splash indigo se anima y desaparece, y luego se ven las 3 pestañas con iconos sobre fondo lavanda (sin pantalla en blanco). Verificado con `npx expo start -c --android` en emulador Pixel_6a: bundle Android correcto y jerarquía de UI con las 3 pestañas; navegación a Controls y Settings comprobada.
- [x] La barra usa `Tabs` de `expo-router`; no quedan imports de `NativeTabs` ni `_layout.web.tsx`.
- [x] `@expo/vector-icons` está declarado en `package.json` y `package-lock.json` (`^15.0.2`).
- [x] Existen `src/domain/models/greenhouse.types.ts` y `src/domain/repositories/greenhouse.repo.ts` con los tipos y constantes definidos.
- [x] Existen las carpetas `services/mock`, `services/api`, `components/sensors`, `components/actuators` y `hooks` (con `.gitkeep`).
- [x] No quedan imports/referencias a los archivos demo eliminados (`themed-text`, `app-tabs`, `animated-icon`, `explore`, `use-theme`, etc.).

## Decisiones tomadas y descartadas

- **Sí:** grupo `(tabs)` con 3 pantallas placeholder y una barra JS `Tabs` de `expo-router`. Expo Go 58 en Android mostró pantalla en blanco con `NativeTabs`; JS Tabs es 100% JS, funciona igual en nativo y web y permite poner Ionicons con `tabBarIcon`. Se descarta `NativeTabs` y el twin `_layout.web.tsx`.
- **Sí:** contratos de dominio derivados del `README`, sin implementación. Son la base que consumirán las specs de sensores/actuadores/simulador.
- **Sí:** extraer `AnimatedSplashOverlay` a `components/ui/` y eliminar el logo demo. El overlay es imprescindible para desbloquear el splash; el logo es demo.
- **Sí:** tabs con label + iconos Ionicons (`home` / `options` / `settings`, outline al no seleccionar y filled al seleccionar). `@expo/vector-icons` pasa a ser dependencia directa.
- **Sí:** paleta indigo `#4F46E5` + lavanda `#EEF2FF` en tema, splash, `app.json` y placeholders; sustituye al azul del starter.
- **Sí:** `src/global.d.ts` declarando `*.css` para resolver el error de tipo. Mantiene `global.css` (variables de fuente web) sin tocar `theme.ts`.
- **No:** motor de simulación, TanStack Query, NativeWind, pantallas con datos, pruebas. Van en specs posteriores.
- **No:** DTOs de un backend real. No hay contrato Spring Boot en el repo; se deriva del `README` y se ajustará al integrar.

## Riesgos

| Riesgo                                                                          | Mitigación                                                                                 |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Borrar `animated-icon.tsx` sin extraer el overlay deja la app colgada en splash | El paso 2 extrae `AnimatedSplashOverlay` antes de borrar nada                              |
| Pantalla en blanco en Expo Go 58 con NativeTabs                                 | Barra JS `Tabs` de `expo-router` en el paso 3 + verificación con caché limpia en el paso 7 |
| Borrar assets referenciados por `app.json` rompe el build                       | Lista explícita de assets a conservar en el paso 4                                         |
| Tipos de `tabBarIcon` / Ionicons al tipar la barra JS                           | Usar los tipos de `expo-router` y los nombres exportados por `@expo/vector-icons/Ionicons`; validar con `npx tsc --noEmit` |

## Qué **no** está en esta spec

- Motor de simulación mock ni servicio API real.
- Pantallas con datos (sensores, sliders, bomba, compuerta).
- `hooks/useGreenhouse.ts` y TanStack Query.
- Barra nativa (`NativeTabs`) ni twin `_layout.web.tsx` (descartados por compatibilidad con Expo Go).
- Pruebas, CI o `eas.json`.

Cada uno de esos, si llega, va en su propia spec.
