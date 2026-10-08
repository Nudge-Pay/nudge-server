<p align="center"><img src="assets/brand/nudge-mark.png" alt="Nudge" width="120" /></p>

# Nudge — Server

![CI](https://github.com/Nudge-Pay/nudge-server/actions/workflows/ci-server.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Stellar](https://img.shields.io/badge/Stellar-Soroban-7D00FF?logo=stellar&logoColor=white)

Backend for **Nudge**, an open-source contactless-payment prototype built around [Stellar](https://stellar.org) testnet.

The backend contains payment-request validation and persistence, passkey-based payment authorization, and a Stellar integration service for transaction building, submission and confirmation polling. Connecting these services into a complete client-to-network payment flow remains active development work.

> **Mobile client:** The Expo app lives in a separate repository — [Nudge-Pay/nudge-payments](https://github.com/Nudge-Pay/nudge-payments).

## Table of Contents

- [How Nudge uses Stellar](#how-nudge-uses-stellar)
- [Project status](#project-status)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Project setup](#project-setup)
- [Scripts](#scripts)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Supported assets (MVP)](#supported-assets-mvp)
- [Environment variables](#environment-variables)
- [Security notes](#security-notes)

## How Nudge uses Stellar

Stellar is the intended settlement network for Nudge payments. The product goal is a short path from sharing a payment request to approving and confirming an XLM or issued-asset transfer. NFC carries the request between devices; funds move through a signed Stellar transaction and network confirmation.

This repository implements the server-side building blocks with `@stellar/stellar-sdk`:

| Capability                  | Implementation                                                                                                                            | Role in Nudge                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Network access              | [StellarModule](src/stellar/stellar.module.ts)                                                                                            | Configures Horizon and Stellar RPC clients, the network passphrase and the USDC issuer                               |
| Accounts and assets         | [StellarService](src/stellar/stellar.service.ts) — `getAccount`, `resolveAsset`                                                           | Loads source accounts; resolves native XLM or USDC by its configured issuer                                          |
| Payment construction        | `StellarService.buildPaymentTransaction`                                                                                                  | Builds an unsigned `Operation.payment` transaction with fee, network passphrase, optional memo and a bounded timeout |
| Submission and confirmation | `StellarService.submitTransaction`, `pollTransactionStatus`                                                                               | Accepts signed XDR, submits through Horizon and polls for an ingested outcome with bounded retries                   |
| RPC support                 | `StellarService.getHealth`, `simulateTransaction`                                                                                         | Checks provider health and exposes transaction simulation at the service level                                       |
| Payment requests            | [Contract validator](src/contracts/payment-request.v1.ts) and [request service](src/modules/payment-requests/payment-requests.service.ts) | Validates supported assets, amount strings, recipient format and timestamps before persistence                       |

The transaction helpers have mocked regression coverage in [stellar.service.spec.ts](src/stellar/stellar.service.spec.ts). They are not yet exposed as a complete public settlement API, and a completed real-device transfer has not been demonstrated. WebAuthn authorizes an application payment action; Stellar transaction signatures and network confirmation remain separate parts of the intended flow.

### Work that advances the Stellar integration

- [Align the client/server payment payload](https://github.com/Nudge-Pay/nudge-server/issues/3) so NFC requests can pass server validation consistently.
- [Strengthen memo byte limits and confirmation polling coverage](https://github.com/Nudge-Pay/nudge-server/issues/52).
- [Protect authorization failure ordering](https://github.com/Nudge-Pay/nudge-server/issues/64) before connecting authorization to submission.

The current prototype targets Stellar testnet. XLM is represented as the native asset; issued assets are identified by both code and issuer, so the USDC issuer must match the selected network. See [Stellar's asset model](https://developers.stellar.org/docs/learn/fundamentals/stellar-data-structures/assets).

## Project status

Nudge is an early Stellar testnet prototype under active development. It is not ready for real funds or production payment use.

| Area             | Current status                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Web preview      | [Live UI preview](https://nudge-payments.vercel.app/); browser passkey setup and NFC are unavailable                     |
| Mobile           | Native onboarding, wallet and receive-flow code; requires a development build and physical-device validation            |
| Sending payments | Client Send screen is a scaffold; end-to-end payment completion is not demonstrated                                     |
| Authentication   | Client auth uses local challenges and placeholder API responses; server verification integration remains unfinished     |
| Shared payload   | Client and server currently use different type/timestamp formats; reconciliation is tracked in the contribution backlog |
| Compatibility    | Passkey RP domain and app/storage/NFC identifiers are pending a coordinated migration decision                          |

See [contributing](CONTRIBUTING.md) and [Wave preparation](docs/wave-readiness.md) for current priorities. Architecture/build-plan documents include intended features and must not be treated as proof of completed functionality.

## Tech stack

| Layer            | Technology                             |
| ---------------- | -------------------------------------- |
| Framework        | NestJS 11                              |
| Language         | TypeScript 5.7 (strict)                |
| ORM              | Prisma + PostgreSQL                    |
| Database hosting | Supabase                               |
| Session auth     | Supabase Auth (JWT)                    |
| Payment auth     | WebAuthn (passkeys)                    |
| Blockchain       | `@stellar/stellar-sdk` (Horizon + RPC) |
| Validation       | `class-validator`, `class-transformer` |
| Config           | `@nestjs/config` + Joi                 |
| API docs         | `@nestjs/swagger`                      |
| Tests            | Jest + Supertest                       |

## Prerequisites

- **Node.js 20+** and npm
- A **Supabase** project with PostgreSQL (`DATABASE_URL` and `DIRECT_URL`)
- Stellar **testnet** access (default URLs are provided in `.env.example`)

## Project setup

```bash
# Install dependencies
npm install

# Configure environment (Windows: copy .env.example .env)
cp .env.example .env
# Edit .env with your Supabase credentials and secrets

npm run prisma:generate
npm run prisma:migrate

# Start development server
npm run start:dev
```

The API is versioned under `/v1`. Swagger UI is available at `/docs` when the server is running.

## Scripts

| Command                   | Description             |
| ------------------------- | ----------------------- |
| `npm run start:dev`       | Start with hot reload   |
| `npm run start:prod`      | Run compiled build      |
| `npm run build`           | Compile TypeScript      |
| `npm run lint`            | Run ESLint              |
| `npm test`                | Unit tests              |
| `npm run test:e2e`        | End-to-end tests        |
| `npm run test:cov`        | Coverage report         |
| `npm run prisma:generate` | Generate Prisma client  |
| `npm run prisma:migrate`  | Create/apply migrations |
| `npm run prisma:studio`   | Open Prisma Studio      |
| `npm run prisma:seed`     | Seed development data   |

## Project structure

Project structure:

```
nudge-server/
├── prisma/                 # Schema, migrations, seed
├── docs/                   # Architecture, build plan, contracts
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── config/             # ConfigModule + env validation
│   ├── common/             # Filters, interceptors, decorators
│   ├── database/           # PrismaService (global)
│   ├── auth/               # Supabase JWT guards
│   ├── stellar/            # Horizon/RPC integration
│   ├── webauthn/           # Passkey verification
│   ├── contracts/          # payment-request.v1 contract
│   └── modules/
│       ├── users/
│       ├── payment-requests/
│       └── payments/
└── test/                   # E2E tests
```

## Documentation

| Document                                                                           | Description                        |
| ---------------------------------------------------------------------------------- | ---------------------------------- |
| [docs/nudge-overview.md](./docs/nudge-overview.md)                                   | Product vision and UX flows        |
| [docs/server-build-plan.md](./docs/server-build-plan.md)                           | Full server build plan (SRV tasks) |
| [docs/server-build-plan-consolidated.md](./docs/server-build-plan-consolidated.md) | Consolidated task reference        |

## Supported assets (MVP)

| Asset | Network         | Notes                                      |
| ----- | --------------- | ------------------------------------------ |
| XLM   | Stellar testnet | Native asset                               |
| USDC  | Stellar testnet | Issuer via `STELLAR_USDC_ISSUER` in `.env` |

## Environment variables

Copy `.env.example` to `.env` and replace placeholders with your values. Variable groups:

- **App** — `NODE_ENV`, `PORT`, `API_PREFIX`, `CORS_ORIGINS`
- **Database** — `DATABASE_URL`, `DIRECT_URL` (Supabase PostgreSQL)
- **Supabase Auth** — `SUPABASE_URL`, `SUPABASE_JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`
- **Stellar** — network, Horizon/RPC URLs, USDC issuer, network passphrase
- **WebAuthn** — RP ID, name, and origin (must match the Expo client)
- **Payments / rate limiting** — submit timeouts, poll intervals, throttle settings

See `.env.example` for the full list with placeholder values.

## Security notes

- Never commit `.env` or real secrets to the repository.
- Do not log JWTs, service role keys, or raw WebAuthn challenges.
- Hybrid auth model: Supabase session for API access + WebAuthn for payment approval.

## License

[MIT](LICENSE).
