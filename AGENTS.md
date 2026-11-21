# Greenhouse Frontend — Expo SDK 58

## Reality check
- Code is still the Expo Router starter: `src/app/{_layout,index,explore}.tsx`, `src/components/*`, `src/constants/theme.ts`. There is no `domain/`, `services/`, DTOs, TanStack Query, NativeWind, or test code yet.
- `README.md` describes/claims the Phase-1 greenhouse simulator (`GreenhouseRepository`, mock engine, PWM/cooldown rules) and a target `src/` tree. Treat it as design intent; trust the actual files. Its "SDK 52+" line is stale — `package.json` says SDK 58.

## Docs & versions
- `expo ~58.0.26`, `react-native 0.88.1`, React 19.3.0. `package-lock.json` only — use `npx`/`npm`, not `bunx`.
- Before using any Expo/EAS/RN API, check https://docs.expo.dev/versions/v58.0.0/ and https://docs.expo.dev/llms.txt. Pre-SDK-58 API knowledge is unreliable here.

## Verification commands
- `npm start` / `npm run android|ios|web` — dev server; `npx tsc --noEmit` — typecheck.
- `npx tsc --noEmit` currently exits 1 with 3 known template errors: CSS-module types in `components/animated-icon.web.tsx`, a `ref` type in `components/app-tabs.web.tsx`, and the side-effect import of `@/global.css` in `constants/theme.ts`. Don't assume you caused them.
- `npm run lint` (`expo lint`) is not a working gate: no ESLint config/deps are committed, and the first run auto-installs ESLint, then fails with `requires ESLint version 8.57.0 or greater`. Use `npx eslint .` only after explicitly setting ESLint up.
- No test script/framework, CI workflows, or `eas.json` exist.

## App wiring
- Routes: `src/app/` (entry `expo-router/entry`); `@/*` → `./src/*`, `@/assets/*` → `./assets/*`.
- Platform twins exist: `animated-icon.web.tsx`, `app-tabs.web.tsx`, `use-color-scheme.web.ts`. Change native and `.web` versions together.
- `_layout.tsx` calls `SplashScreen.preventAutoHideAsync()` at import time; `AnimatedSplashOverlay` in `components/animated-icon.tsx` is what hides it. Removing that overlay leaves the app stuck on splash.
- Tabs use `NativeTabs` from `expo-router/native-tabs`, not the older `Tabs` API.
- `app.json` enables `typedRoutes` + `reactCompiler`; `.expo/types/**` and `expo-env.d.ts` are generated/gitignored — don't hand-edit. Web uses `output: "server"`, not static export.
- No `ios/`/`android/` dirs (Continuous Native Generation): configure native behavior only in `app.json`/config plugins. Native-only modules need a development build; Expo Go is not enough.

## Local workflow
- `.agents/skills/{spec,spec-impl}` (pinned in `skills-lock.json`) define spec-driven work: specs go in `specs/NN-slug.md`; `/spec-impl` requires an "Approved" spec, creates `spec-NN-slug` by default, and pauses after each step. `.agents/*` is gitignored.
