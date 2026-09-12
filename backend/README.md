# TrainRekt Backend

This backend hosts server-side foundations for TrainRekt's upcoming generic Solana Token Inspector.

The long-term product flow is:

Mobile -> TrainRekt API -> Helius -> deterministic analysis -> later AI explanation

This repository change implements the first backend MVP for generic token inspection plus the underlying API foundation.

## What This API Is For

- Keep third-party API credentials server-side
- Provide backend endpoints for future token-inspection flows
- Isolate infrastructure integration (Helius) behind clean application abstractions

The mobile app must never receive the Helius API key.

## Local Startup

From the repository root:

```bash
cd backend
dotnet run --project TrainRekt.Api
```

The API starts with `/health` available for local verification.

## Health Endpoint

- `GET /health`
- Returns a structured JSON payload with status, service name, and UTC timestamp

## Token Inspection Endpoint

- `POST /api/token-inspections`

Request body:

```json
{
	"mint": "<solana mint address>"
}
```

The endpoint validates the Solana public key, inspects mint/account facts via Helius-backed Solana RPC methods, supports SPL Token and Token-2022 mint ownership, and returns neutral technical review signals.

The endpoint does not return buy/sell advice or safety verdicts.

## Helius Configuration

The API expects a `Helius` section for non-sensitive defaults:

- `RpcBaseUrl`

The API key is loaded from environment variables and must not be committed.

Supported environment variable:

- `HELIUS_API_KEY`

### Linux/macOS (bash)

```bash
export HELIUS_API_KEY="your-helius-api-key"
cd backend
dotnet run --project TrainRekt.Api
```

### Windows PowerShell

```powershell
$env:HELIUS_API_KEY = "your-helius-api-key"
cd backend
dotnet run --project TrainRekt.Api
```

Do not put real secrets in `appsettings.json`.

## MongoDB Snapshot Cache Configuration

Token inspection snapshot caching is controlled explicitly by `MongoDb:Enabled`.

Non-sensitive defaults are in `TrainRekt.Api/appsettings.json`:

- `MongoDb:DatabaseName` (default `trainrekt`)
- `MongoDb:TokenCollectionName` (default `tokens`)
- `MongoDb:TokenInspectionCollectionName` (default `tokenInspections`)
- `TokenInspectionCache:FreshnessMinutes` (default `5`)

Local no-cache mode:

- `MongoDb:Enabled=false`
- Token inspection uses passthrough deterministic inspection without Mongo persistence.

Local Mongo cache mode:

- `MongoDb:Enabled=true`
- `MongoDb:ConnectionString` must be configured.
- `MongoDb:DatabaseName`, `MongoDb:TokenCollectionName`, and `MongoDb:TokenInspectionCollectionName` must be non-empty.

When `MongoDb:Enabled=true`, invalid or missing required Mongo options fail startup validation. The API does not silently fall back to passthrough mode.

Run local MongoDB with Docker:

```bash
docker run -d \
	--name trainrekt-mongo \
	-p 27017:27017 \
	mongo:7
```

Set the connection string using user secrets (recommended for local dev):

```bash
cd backend/TrainRekt.Api
dotnet user-secrets set "MongoDb:Enabled" "true"
dotnet user-secrets set "MongoDb:ConnectionString" "mongodb://localhost:27017"
```

Alternative environment variable:

```bash
export MONGODB_CONNECTION_STRING="mongodb://localhost:27017"
```

Production environment-variable example:

```bash
export MongoDb__Enabled=true
export MongoDb__ConnectionString="<secret>"
```

No MongoDB credentials or production connection strings should be committed.

## CORS (Development)

A development-only CORS policy is configured for local TrainRekt client origins (localhost variants).
No unrestricted production-wide policy is enabled by default; production origins should be explicitly configured later.

## Notes

- Helius integration is wired through `IHttpClientFactory`.
- Holder concentration metrics are token-account concentration based on `getTokenLargestAccounts`, not verified beneficial-owner concentration.
- Age detection is intentionally conservative in this MVP and may be unavailable when reliable derivation would require expensive historical scanning.
- AI explanation, swap execution, and mobile changes are not part of this backend phase.
