# Demo Preflight

This is the reproducibility and demo checklist for the Solana Mobile hackathon build. It describes the current repository workflow; it does not replace the product security boundaries documented in the root README and `mobile/README.md`.

## 1. Prerequisites

### Backend

- .NET SDK 8.x. The API targets `net8.0`.
- A Helius API key for token inspection and wallet inspection data.
- MongoDB is optional for the demo and is disabled by default.
- Gemini is optional for the demo and is disabled by default.

### Mobile

- Node.js and npm. This repository does not pin a Node version in `package.json`; use a current Node LTS release.
- Android SDK, platform tools, and `adb`.
- JDK 17 or newer.
- A physical Android device. Use a Solana Seeker or another Android device with a compatible Solana wallet for wallet-connected flows.
- A development build. Expo Go is not sufficient for Solana Mobile Wallet Adapter (MWA).

The checked-in mobile dependency manifest targets Expo `~57.0.21`, React Native `0.86.3`, React `19.2.3`, Expo Router `~57.0.20`, and TypeScript `~6.0.3`. Install from `mobile/package-lock.json` with `npm install`.

## 2. Backend Setup

From the repository root:

```bash
cd backend/TrainRekt.Api
dotnet user-secrets set "Helius:ApiKey" "<your-helius-api-key>"
cd ../..
dotnet run --project backend/TrainRekt.Api --launch-profile http
```

The `http` launch profile binds the API to `http://localhost:5256` and sets `ASPNETCORE_ENVIRONMENT=Development`. Verify it from the same machine:

```bash
curl http://localhost:5256/health
```

Expected response shape:

```json
{"status":"ok","service":"TrainRekt.Api","timestampUtc":"<utc timestamp>"}
```

The backend also accepts `HELIUS_API_KEY` as an environment variable. Do not place the key in `appsettings.json`, source control, or the mobile app.

## 3. Exact Demo Configuration

Use these repository defaults for the deterministic demo:

| Setting | Demo value | Meaning |
| --- | --- | --- |
| Backend launch profile | `http` | Serves `http://localhost:5256` |
| `Helius:RpcBaseUrl` | `https://mainnet.helius-rpc.com` | Mainnet Helius RPC endpoint |
| Helius credential | User Secret `Helius:ApiKey` or `HELIUS_API_KEY` | Required when inspection invokes Helius |
| `Gemini:Enabled` | `false` | AI coach and Gemini-backed external context are off |
| `AiSafetyCoach:Enabled` | `false` | Deterministic inspection remains the primary path |
| `TokenExternalContext:Enabled` | `true` | Feature is configured, but it requires Gemini to be enabled and keyed to produce Gemini context |
| `MongoDb:Enabled` | `false` | No MongoDB is required; persistence/cache uses the no-Mongo path |
| `EXPO_PUBLIC_TRAINREKT_API_BASE_URL` | `http://<demo-computer-LAN-IP>:5256` | Mobile-to-backend URL; use the computer's LAN IP, not `localhost` |
| `EXPO_PUBLIC_SOLANA_NETWORK` | unset, defaults to `mainnet-beta` | Mobile public RPC network |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | unset, defaults to `clusterApiUrl(mainnet-beta)` | Optional mobile RPC override |
| `REAL_MESSAGE_SIGNING_ENABLED` | `false` in source | Real message signing remains disabled |

For a phone on the same Wi-Fi network, create or update the ignored local file `mobile/.env` with the backend machine's LAN address:

```dotenv
EXPO_PUBLIC_TRAINREKT_API_BASE_URL=http://<demo-computer-LAN-IP>:5256
```

The value is embedded into the Expo development build at startup. Restart the dev server after changing it. Do not commit `mobile/.env`.

To enable optional Gemini behavior for a separate experiment, keep the deterministic defaults above and set both feature flags plus the User Secret:

```bash
cd backend/TrainRekt.Api
dotnet user-secrets set "Gemini:Enabled" "true"
dotnet user-secrets set "AiSafetyCoach:Enabled" "true"
dotnet user-secrets set "Gemini:ApiKey" "<your-gemini-api-key>"
```

That is not required for the baseline demo and makes the demo dependent on an external AI service.

## 4. Android / Seeker Workflow

1. Connect the Android device by USB, enable developer options and USB debugging, and confirm it appears in `adb devices`.
2. Confirm the phone and development computer are on the same network when the app must call the local backend.
3. Set `mobile/.env` to the computer's LAN URL as shown above.
4. Install dependencies and build the native development client:

   ```bash
   cd mobile
   npm install
   npx expo run:android --device
   ```

5. Start Metro for the installed development client:

   ```bash
   npx expo start --dev-client --clear
   ```

6. Open TrainRekt on the device. For wallet flows, use the device's installed compatible Solana wallet when the MWA authorization prompt appears.
7. Demonstrate the read-only Wallet Safety inspection, training flows, and token analysis. Training approvals and signatures are simulated; the app does not submit real asset transactions.
8. To test Android share intake, share text containing one Solana token mint into TrainRekt. The configured Android intent filter accepts `text/plain` and routes a single recognized mint to Token Analysis.

A fresh clone may not contain native folders because `mobile/android` and `mobile/ios` are ignored generated output. In the current workspace, an Android development build is already generated locally. If `mobile/android` is absent, run the Expo prebuild workflow appropriate to the checked-in Expo SDK before `npx expo run:android --device`; this step was not needed to validate the current workspace.

## 5. Validation

Backend, from the repository root:

```bash
dotnet build backend/TrainRekt.Api/TrainRekt.Api.csproj
dotnet test backend/TrainRekt.Api.Tests/TrainRekt.Api.Tests.csproj
```

Mobile, from `mobile/`:

```bash
npm run typecheck
npm run lint
npm test -- --run
npx expo export --platform android --output-dir /tmp/trainrekt-mobile-check
```

The export command verifies that Expo can produce an Android bundle; it does not replace installing and testing the native development build on a physical device.

## 6. Preflight Checklist

- [ ] Backend prerequisites are installed: .NET 8 SDK, Node/npm, Android SDK/platform tools, JDK 17+, and a physical Android device.
- [ ] `adb devices` shows the demo phone as authorized.
- [ ] The backend starts with the `http` launch profile.
- [ ] `GET http://localhost:5256/health` returns status `ok`.
- [ ] `Helius:ApiKey` is available through User Secrets or `HELIUS_API_KEY` and is not in a tracked file.
- [ ] Gemini is off for the baseline demo: `Gemini:Enabled=false`, `AiSafetyCoach:Enabled=false`.
- [ ] Mongo is off for the baseline demo: `MongoDb:Enabled=false`.
- [ ] `mobile/.env` points to `http://<demo-computer-LAN-IP>:5256`.
- [ ] Phone and computer can reach each other over the demo network; do not use `localhost` in the phone's API URL.
- [ ] The Android development build installs and starts with `npx expo start --dev-client --clear`.
- [ ] A compatible Solana wallet is installed on the phone for MWA connection.
- [ ] Wallet Safety shows read-only inspection behavior and no transaction/signing prompt is used for the baseline demo.
- [ ] Token Analysis opens directly from a shared `text/plain` token mint.
- [ ] Backend build/tests, mobile typecheck/lint/tests, and Android export pass before recording.
- [ ] No `.env`, User Secrets contents, API keys, private keys, seed phrases, APK/AAB, or generated build output is included in the recording or commit.
- [ ] `git status --short` shows only intentionally prepared documentation or release files.

## 7. Secret and Git Hygiene

- The repository ignores local `.env` files, backend local appsettings, `node_modules`, Expo output, native generated folders, `.NET` `bin/` and `obj/`, APK/AAB files, and release output.
- `mobile/.env` is local-only. Its public Expo variables are configuration, not a place for backend credentials.
- Backend secrets belong in .NET User Secrets or environment variables. User Secrets are stored outside the repository.
- Before sharing the repository or recording the demo, inspect `git status --short` and `git ls-files`; never use `git add -f` for ignored credentials or generated artifacts.

## 8. Known Documentation Limits

The following cannot be verified from repository files alone and must be checked on the demo setup:

- The exact Android device model, installed wallet app/version, wallet account, USB authorization state, and network reachability.
- The operator's LAN IP and whether firewall rules allow TCP port `5256` from the phone.
- The validity, quota, and network permissions of the Helius API key.
- Whether a specific Seeker wallet accepts the current MWA identity configuration.
- Expo prebuild output on a fresh clone when ignored native folders are absent.
- The visual quality, latency, and availability of live Solana RPC responses during the recording.

At the time of this documentation pass, no backend or mobile production/test source files were changed for the preflight task.
