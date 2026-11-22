# Greenhouse Frontend — Expo SDK 58

## Reality check
- SPEC 01 base structure is in place: `src/domain/{models,repositories}`, empty `src/services/` + `src/components/{sensors,actuators}` + `src/hooks/` folders, and `src/app/(tabs)/` with three placeholder screens. No mock engine, API client, real data screens, TanStack Query, NativeWind, or test code yet.
- `README.md` describes/claims the Phase-1 greenhouse simulator (`GreenhouseRepository`, mock engine, PWM/cooldown rules) and a target `src/` tree. Treat it as design intent; trust the actual files. Its "SDK 52+" line is stale — `package.json` says SDK 58.

## Docs & versions
- `expo ~58.0.26`, `react-native 0.88.1`, React 19.3.0. `package-lock.json` only — use `npx`/`npm`, not `bunx`.
- Before using any Expo/EAS/RN API, check https://docs.expo.dev/versions/v58.0.0/ and https://docs.expo.dev/llms.txt. Pre-SDK-58 API knowledge is unreliable here.

## Verification commands
- `npm start` / `npm run android|ios|web` — dev server; `npx tsc --noEmit` — typecheck.
- `npx tsc --noEmit` currently exits 0. `src/global.d.ts` declares `*.css` / `*.module.css` so the `@/global.css` side-effect import in `constants/theme.ts` typechecks.
- `npm run lint` (`expo lint`) is not a working gate: no ESLint config/deps are committed, and the first run auto-installs ESLint, then fails with `requires ESLint version 8.57.0 or greater`. Use `npx eslint .` only after explicitly setting ESLint up.
- No test script/framework, CI workflows, or `eas.json` exist.

## App wiring
- Routes: `src/app/` (entry `expo-router/entry`); `@/*` → `./src/*`, `@/assets/*` → `./assets/*`.
- Only `src/components/ui/splash-overlay.web.tsx` remains as a platform twin (returns `null` on web); the starter twins (`animated-icon`, `app-tabs`, `use-color-scheme`) were removed with SPEC 01.
- `_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` at import time; `AnimatedSplashOverlay` in `src/components/ui/splash-overlay.tsx` is what hides it. Removing that overlay leaves the app stuck on splash.
- Tabs use the JavaScript `Tabs` API from `expo-router` (no `NativeTabs`, no `_layout.web.tsx`) with Ionicons `home` / `options` / `settings` from `@expo/vector-icons`, a direct dependency. Brand colors: indigo `#4F46E5` + lavanda `#EEF2FF` in `src/constants/theme.ts`.
- `app.json` enables `typedRoutes` + `reactCompiler`; `.expo/types/**` and `expo-env.d.ts` are generated/gitignored — don't hand-edit. Web uses `output: "server"`, not static export.
- No `ios/`/`android/` dirs (Continuous Native Generation): configure native behavior only in `app.json`/config plugins. Native-only modules need a development build; Expo Go is not enough.

## Local workflow
- `.agents/skills/{spec,spec-impl}` (pinned in `skills-lock.json`) define spec-driven work: specs go in `specs/NN-slug.md`; `/spec-impl` requires an "Approved" spec, creates `spec-NN-slug` by default, and pauses after each step. `.agents/*` is gitignored.
