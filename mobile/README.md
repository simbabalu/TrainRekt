# TrainRekt Mobile

TrainRekt is a local crypto decision-training simulator built with Expo, React Native, TypeScript, and Expo Router. It uses mock scenarios only: no real trades, wallet connections, backend, or persistent storage are included.

## Run the app

From this directory:

```bash
npm install
npx expo start --android
```

The Android command opens the app on a connected device or emulator. The project also supports Expo Go on Android.

## App routes

- `/`: Home dashboard with training score and today's challenge
- `/train`: SOL momentum scenario and decision evaluation
- `/explore`: Progress, skills, and recent training history
- `/settings`: Difficulty and local preference controls

## Architecture

- `src/data/` contains mock scenarios and progress records.
- `src/data/scenarioCatalog.ts` contains the twelve typed training scenarios.
- `src/types/` contains domain interfaces and decision types.
- `src/domain/training/` contains pure scenario evaluation logic.
- `src/domain/training/` also contains weakest-skill and adaptive scenario selection logic.
- `src/domain/progress/` contains pure XP, level, streak, skill, and history calculations.
- `src/context/` owns the in-memory application progress state.
- `src/hooks/` contains stateful training behavior.
- `src/components/` contains reusable presentation components.
- `src/constants/theme.ts` contains shared colors, spacing, radii, and typography.

The mock data boundary is intentional. It can later be replaced by API or persistent-storage adapters without moving business logic into screens.

## Checks

Run the strict TypeScript check from the mobile directory:

```bash
./node_modules/.bin/tsc --noEmit --project tsconfig.json
```

Run lint and unit tests:

```bash
npm run lint
npm test
```

Build an Android export for bundle validation:

```bash
npx expo export --platform android
```

## Current MVP limitations

- Progress updates in memory when a training decision is submitted and resets when the app process restarts.
- The catalog currently contains twelve scenarios. The next recommendation prioritizes weak skills, recent mistakes, selected difficulty, and scenario variety without immediately repeating the current scenario.
- Settings are local React state and are not persisted.
- There is no backend, wallet integration, Seed Vault integration, or real asset trading.
