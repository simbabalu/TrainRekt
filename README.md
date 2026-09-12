# TrainRekt

> Get rekt in training. Not on-chain.

TrainRekt is an interactive crypto decision and wallet-safety training app for Solana Mobile. It teaches by making users decide through realistic scenarios, then explaining outcomes and tracking progress over time. Wallet connection and inspection use real public Solana data, while training decisions remain simulated.

## Why TrainRekt?

Crypto users are often pushed into high-impact decisions quickly: risk management, signatures, permissions, suspicious claims, and wallet-account behavior. These decisions can be expensive to learn in production.

TrainRekt moves that learning into practice mode first. Users can train decision quality, build wallet-safety habits, and review progress before real assets are on the line.

## Demo

- Hackathon demo video: [demo/trainrekt-hackathon-demo.mp4](demo/trainrekt-hackathon-demo.mp4)
- Demo video build script: [demo/build-demo-video.sh](demo/build-demo-video.sh)

## What You Can Train

Current runtime catalog (41 exercises):

- Decision Training
- Signature Simulation
- Transaction Inspection
- Permission Challenges
- Scam Detection
- Red Flag Identification
- Surprise Security Challenges (wallet-connected trigger)

## Real Wallet, Safe Training

TrainRekt integrates Solana Mobile Wallet Adapter (MWA) for wallet authorization/connection on Android development builds.

Real wallet behavior:

- Wallet authorization/connection through MWA
- Local wallet disconnect/state clearing
- Public wallet identity display (address/label)
- Read-only RPC wallet snapshot and token-account inspection

Simulated training behavior:

- Signature decisions in exercises
- Transaction-approval decisions in exercises
- Permission decisions in exercises
- Surprise challenge decisions

TrainRekt does not submit real asset transactions.

Real message signing infrastructure exists in the wallet boundary, but runtime signing is currently disabled (`REAL_MESSAGE_SIGNING_ENABLED = false`).

## Learn From Your Wallet

Implemented loop:

Train -> Connect -> Inspect -> Learn -> Improve

Wallet Safety performs read-only inspection of token-account and mint-level properties, derives educational technical signals, and maps them to targeted training topics.

Signals are educational review signals, not automatic scam/safety verdicts.

## Training System

- Daily Training goal: 3 completed daily decisions
- Daily completion bonus: +150 XP (awarded once when goal is reached)
- Extra Practice: available after daily completion
- Practice XP multiplier: 25% of base XP
- Wallet lesson replays: XP becomes 0 after that wallet lesson reward was already claimed
- Adaptive selection: weighted by weak skills, difficulty preference, recent mistakes, and recent-repeat penalty
- Difficulty preference: Beginner / Intermediate / Advanced
- Progress: XP, level, win rate, streaks, skill scores, recent history
- Achievements: security-training achievements earned through completed challenges
- Local persistence: AsyncStorage with schema normalization/hydration

## Solana Mobile Integration

TrainRekt is implemented as an Expo/React Native app with Android development-build workflow and Solana mobile wallet integration.

Verified integration points:

- Solana Mobile Wallet Adapter for connection flow
- Solana RPC reads for snapshot and inspection data
- Physical-device Android flow for wallet-connected training and Wallet Safety

## Security Model

- No seed phrase or private-key handling in app logic
- No real asset transaction submission
- Training signature/transaction/permission decisions are simulated
- Wallet inspection is read-only RPC
- Sensitive MWA auth token is kept in memory and not persisted in training progress storage
- Disconnect behavior intentionally clears local wallet state; native deauthorize is currently disabled pending safe upstream behavior validation
- Real wallet message signing is currently disabled in runtime

## Architecture

Mobile app implementation is in [mobile](mobile).

- [mobile/src/app](mobile/src/app): route composition and screen entry points
- [mobile/src/components](mobile/src/components): reusable UI/presentation
- [mobile/src/context](mobile/src/context): application state providers
- [mobile/src/hooks](mobile/src/hooks): screen/application hooks
- [mobile/src/domain](mobile/src/domain): pure business logic
- [mobile/src/data](mobile/src/data): exercise catalogs and static training content
- [mobile/src/services](mobile/src/services): external/native boundaries (wallet + RPC)
- [mobile/src/storage](mobile/src/storage): local persistence adapters
- [mobile/src/constants](mobile/src/constants): theme and app constants
- [mobile/src/types](mobile/src/types): domain models and discriminated unions

Wallet/native integration is isolated behind service boundaries in [mobile/src/services/wallet](mobile/src/services/wallet).

## Tech Stack

- TypeScript
- React Native
- Expo
- Expo Router
- Solana Mobile Wallet Adapter
- @solana/web3.js
- @solana/spl-token
- AsyncStorage
- Vitest
- ESLint

## Running Locally

See [mobile/README.md](mobile/README.md) for full setup and Android development-build workflow.

Note: Expo Go is not sufficient for MWA functionality in this project.

## Android Release / Hackathon APK

The signed hackathon APK artifact is:

- `TrainRekt-1.0.0-hackathon.apk`

SHA-256:

- `9ba20f722f7af945d313886ab43c5039696e32277ee162cb57b9169924a05d73`

The signed hackathon APK is distributed as a GitHub Release/submission artifact rather than stored directly in the source repository.

## Hackathon

TrainRekt was started on September 10, 2026 for the Solana Mobile CLOCK IN hackathon.
