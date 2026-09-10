# TrainRekt Mobile

TrainRekt is a local crypto decision-training simulator built with Expo, React Native, TypeScript, and Expo Router. It includes Android wallet connect/disconnect via Solana Mobile Wallet Adapter (MWA) for public-address identity only. Training simulations remain local and do not sign real transactions or messages.

## Run the app

From this directory:

```bash
npm install
npx expo run:android --device
npx expo start --dev-client --android --port 8081
```

Expo Go is not sufficient for Android wallet functionality. Use an Android development build (`expo run:android`) and launch through `expo-dev-client`.

JDK 17 is required for native Android builds in the current project setup:

```bash
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ORG_GRADLE_JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
cd android
./gradlew app:assembleDebug
```

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
- `src/domain/training/` also contains weakest-skill, adaptive scenario selection, and daily-goal/streak logic.
- `src/domain/progress/` contains pure XP, level, streak, skill, and history calculations.
- `src/context/` owns the persisted training progress and settings state.
- `src/context/WalletContext.tsx` owns wallet lifecycle state (disconnected/connecting/connected/error) and keeps the MWA auth token in memory only.
- `src/hooks/` contains stateful training behavior.
- `src/hooks/useWallet.ts` is the only app-level hook for wallet actions.
- `src/components/` contains reusable presentation components.
- `src/services/wallet/` contains the wallet service boundary and platform-specific implementations.
- `src/constants/theme.ts` contains shared colors, spacing, radii, and typography.

The wallet boundary is intentional: screens/components do not import MWA directly. Android native MWA calls stay behind `src/services/wallet/mobileWalletService`.

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

- Progress and settings persist locally through AsyncStorage and survive app restarts.
- Wallet integration is limited to connect/disconnect and displaying a public address. There is no balance fetching, backend wallet session management, or transaction submission.
- The daily training goal is fixed at 3 completed decisions with a one-time local-day completion bonus.
- The catalog currently contains twelve scenarios. The next recommendation prioritizes weak skills, recent mistakes, selected difficulty, and scenario variety without immediately repeating the current scenario.
- A `__DEV__`-only Settings control can simulate the previous local day to test daily rollover without changing the device clock. It is excluded from production builds.
- Signature Simulation SIGN/REJECT decisions are local training inputs only and do not call real wallet signing APIs.
- There is no backend, Privy integration, direct Seed Vault API integration, or real asset trading.
