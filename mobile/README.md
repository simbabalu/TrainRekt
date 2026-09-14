# TrainRekt Mobile

TrainRekt Mobile is the React Native/Expo implementation of TrainRekt: a Solana-focused decision and wallet-safety training app.

## Requirements

- Node.js (current LTS recommended; no `engines` pin is defined in [package.json](package.json))
- npm
- Android SDK + platform tools
- JDK 17+
- Android device for MWA testing (Solana Seeker or another compatible Android device)

Expo Go is not sufficient for MWA functionality in this project. Use a development build.

## Install

From the repository root:

```bash
cd mobile
npm install
```

## Development

Build and run Android dev client:

```bash
cd mobile
npx expo run:android --device
npx expo start --dev-client --clear
```

If you already have a development build installed on device, you can run only:

```bash
cd mobile
npx expo start --dev-client --clear
```

## Validation

From [mobile](.):

```bash
npm test
npm run lint
npx tsc --noEmit
npx expo export --platform android --output-dir /tmp/trainrekt-mobile-check
```

## Android Release Build

This repo currently ignores generated native folders in [mobile/.gitignore](.gitignore), including `/android` and `/ios`. In practice, `android/` is generated/managed through Expo prebuild workflows and may be absent in a fresh clone until native generation is run.

Release signing is configured in [android/app/build.gradle](android/app/build.gradle) using Gradle properties:

- `TRAINREKT_UPLOAD_STORE_FILE`
- `TRAINREKT_UPLOAD_KEY_ALIAS`
- `TRAINREKT_UPLOAD_STORE_PASSWORD`
- `TRAINREKT_UPLOAD_KEY_PASSWORD`

Use environment/global Gradle properties to provide these values (never hardcode secrets).

Release command that is used in this project workflow:

```bash
cd android
./gradlew assembleRelease
```

Avoid treating `./gradlew clean assembleRelease` as the default command in this codebase. If native autolinking/codegen state is stale, prefer targeted regeneration/re-sync steps over broad clean commands.

## Routes

- `/`: Home
- `/train`: Daily/Practice training session
- `/explore`: Progress
- `/settings`: Settings and data controls
- `/wallet-safety`: Wallet Safety screen (navigable route, hidden tab trigger)
- `/token-analysis`: Token analysis screen (navigable route, hidden tab trigger)

## Architecture

- [src/app](src/app): route composition and screen entry points
- [src/components](src/components): reusable presentation components
- [src/context](src/context): provider-managed app state
- [src/hooks](src/hooks): stateful application hooks
- [src/domain](src/domain): pure business logic
- [src/data](src/data): catalogs and static exercise content
- [src/services](src/services): wallet and Solana RPC boundaries
- [src/storage](src/storage): AsyncStorage persistence adapters
- [src/constants](src/constants): theme and app constants
- [src/types](src/types): domain models and discriminated unions

Wallet native integration is isolated behind [src/services/wallet](src/services/wallet) and consumed through [src/context/WalletContext.tsx](src/context/WalletContext.tsx).

## Exercise Architecture

`TrainingExercise` is a discriminated union in [src/types/exercise.ts](src/types/exercise.ts) with these implemented families:

- `decision`
- `signature-simulation`
- `transaction-inspection`
- `permission-challenge`
- `scam-detection`
- `red-flag-identification`

Runtime catalog assembly is in [src/data/exerciseCatalog.ts](src/data/exerciseCatalog.ts), and rendering dispatch is centralized in [src/app](src/app) by exercise type.

## Training Progress

Training progress is managed by [src/context/TrainingProgressContext.tsx](src/context/TrainingProgressContext.tsx) and persisted in AsyncStorage through [src/storage/trainingProgressStorage.ts](src/storage/trainingProgressStorage.ts).

Current behavior:

- Daily mode increments daily completion counters and can award one daily bonus at goal completion
- Practice mode does not increment daily counters/streaks
- Practice XP uses a 25% multiplier via [src/domain/progress/calculateAwardedExerciseXp.ts](src/domain/progress/calculateAwardedExerciseXp.ts)
- XP, level summary, win rate, streaks, skill scores, and recent history are derived/updated in domain logic
- Surprise challenge completions can award bonus XP and badges
- Achievements are rendered from canonical persisted badge state via [src/domain/progress/getEarnedAchievements.ts](src/domain/progress/getEarnedAchievements.ts)
- `prepareDemo()` (DEV demo tools) resets local training progress, achievements, daily state, and surprise challenge completion

## Wallet Integration

Wallet connection is implemented with Solana Mobile Wallet Adapter on Android in [src/services/wallet/mobileWalletService.impl.android.ts](src/services/wallet/mobileWalletService.impl.android.ts).

Current implemented boundaries:

- MWA authorize/connect and local disconnect state handling
- Public wallet identity usage (address/label)
- Read-only Solana RPC snapshot and inspection in Wallet Safety
- Learn From Your Wallet recommendations based on observed technical signals

Wallet Safety inspection currently reads:

- SPL Token + Token-2022 token accounts
- token account state (including frozen)
- delegation / close authority fields
- mint-level properties (mint/freeze authority state, supply/decimals)
- Token-2022 extension facts (for supported extension kinds)
- best-effort token metadata pointer resolution

These observations are used as educational signals and recommendation inputs; they are not automatic scam verdicts.

## Current Safety Boundaries

- No seed phrase/private-key handling in app business logic
- No real asset transaction submission
- Signature/transaction/permission challenge decisions are simulated training interactions
- Wallet inspection is read-only RPC
- MWA auth token is held in memory and not persisted in training progress storage
- Real wallet message signing path exists in service/context boundaries but is runtime-disabled (`REAL_MESSAGE_SIGNING_ENABLED = false`)
- Disconnect intentionally clears local wallet state; native deauthorize is currently disabled pending verified-safe upstream behavior
- Token analysis integrates with the TrainRekt backend API when `EXPO_PUBLIC_TRAINREKT_API_BASE_URL` is configured
