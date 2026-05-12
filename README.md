<p align="center">
  <img src="frontend/public/favicon.png" alt="Interval logo" width="84" height="84" />
</p>

<h1 align="center">Interval</h1>

<p align="center">
  A Solana-native booking platform for paid creator access.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/status-beta-f59e0b?style=for-the-badge" alt="Beta status" />
  <img src="https://img.shields.io/badge/version-v0.1-111827?style=for-the-badge" alt="Version v0.1" />
  <img src="https://img.shields.io/badge/network-solana_devnet-14f195?style=for-the-badge" alt="Solana Devnet" />
  <img src="https://img.shields.io/badge/contract-anchor-8b5cf6?style=for-the-badge" alt="Anchor contract" />
  <img src="https://img.shields.io/badge/app-next.js-000000?style=for-the-badge" alt="Next.js app" />
</p>

<p align="center">
  <strong>Beta v0.1</strong> - actively evolving toward a production-ready creator access marketplace.
</p>

Interval lets creators publish bookable time slots, set pricing and share a clean public profile. Users can discover creators, reserve a slot, complete payment and receive confirmed access in one flow.

The product is built around a simple idea: make high-signal time with creators, founders and experts easy to sell, easy to buy and easy to verify.

## What It Does

- Public creator profiles with bio, social context, profile image and available slots
- Slot-based booking with price, timing, availability and post-booking access
- Creator dashboard for onboarding, profile management and booking visibility
- Wallet-first user experience with Solana support
- On-chain booking escrow, creator registration, treasury, release and refund flows
- Database-backed booking records, creator profiles, user balances and payment state
- Production-ready Next.js app structure with API routes, Prisma and typed React components

## How It Works

Interval has two main layers:

- **Frontend application:** The Next.js app powers discovery, creator pages, onboarding, dashboards, booking screens, API routes, database writes, media uploads, email and wallet-connected user flows.
- **Solana program:** The Anchor contract provides the on-chain foundation for platform state, creator profiles, treasury-backed onboarding, booking escrow, fund release and refunds.

The frontend keeps the product experience simple. The contract keeps the critical booking lifecycle verifiable: a booking can be funded, released to the creator after the scheduled end time, or refunded by an authorized signer.

## Product Flow

1. A creator signs in, completes onboarding and sets up their profile.
2. The creator opens paid availability as individual slots.
3. A user browses creators from Explore or lands on a shared creator page.
4. The user books a slot and completes payment.
5. Interval confirms the booking and unlocks the meeting details for the right user.
6. The on-chain flow can hold booking funds in escrow, then release or refund them according to the booking state.

## Smart Contract

The contract lives in `Interval/contract` and is built with Anchor. It defines the core on-chain objects used by Interval:

- **Platform:** Stores the platform admin, pause state and PDA bump.
- **Treasury:** Holds platform-managed SOL used for creator onboarding flows.
- **CreatorProfile:** Links a creator authority wallet to an active on-chain profile.
- **BookingEscrow:** Stores booking identity, slot hash, buyer, creator, amount, scheduled end time, status and bump.

The program exposes instructions for:

- Initializing the platform and treasury
- Registering or onboarding creators
- Funding a booking escrow
- Releasing funds to the creator after the scheduled end time
- Refunding a booking when authorized

Booking state is intentionally compact: `Funded`, `Released` or `Refunded`. That keeps the contract easy to reason about while the frontend handles the richer product experience around profiles, calendars, booking metadata and access.

Current program ID:

```text
4ATtXLmT25nh447GjP9BtdWJudN8uuqcNNmawRWexfx6
```

The contract is currently deployed on Solana Devnet. You can view the deployed program on Solscan:

```text
https://solscan.io/account/4ATtXLmT25nh447GjP9BtdWJudN8uuqcNNmawRWexfx6?cluster=devnet
```

## Repository Structure

```text
Interval/
  frontend/     Next.js app, API routes, Prisma schema, UI components
  contract/     Anchor workspace for Interval's Solana program
```

## Tech Stack

- **Frontend:** Next.js, React, TypeScript, Tailwind CSS
- **Database:** PostgreSQL with Prisma
- **Auth and wallets:** Privy and Solana wallet tooling
- **Blockchain:** Solana, Anchor, SPL token utilities, Solana Actions
- **Media and email:** Cloudinary and Resend
- **Package manager:** Bun

## Getting Started

### Prerequisites

- Bun 1.3+
- Node.js compatible with the Next.js version in `frontend/package.json`
- PostgreSQL database
- Solana RPC endpoint
- Anchor toolchain, if you plan to build or test the contract workspace

### Frontend

```bash
cd Interval/frontend
bun install
bun run db:generate
bun run db:migrate
bun dev
```

The app runs at `http://localhost:3000` by default.

Create your local environment file from the variables used by the app. At minimum, configure the database URL, public app URL, Solana network/RPC settings, wallet auth credentials, media upload credentials and email credentials.

### Contract

```bash
cd Interval/contract
anchor build
anchor test
```

Important contract files:

- `Interval/contract/programs/interval/src/lib.rs` - Program entrypoint and instruction exports
- `Interval/contract/programs/interval/src/instructions/mod.rs` - Instruction handlers and account validation
- `Interval/contract/programs/interval/src/state/mod.rs` - Platform, treasury, creator and booking escrow accounts
- `Interval/contract/programs/interval/src/errors.rs` - Contract error definitions
- `Interval/contract/tests/interval.test.cjs` - Contract tests

## Useful Commands

Run these from `Interval/frontend`:

| Command | Description |
| --- | --- |
| `bun dev` | Start the local development server |
| `bun run build` | Build the production app |
| `bun run start` | Start the production server |
| `bun run lint` | Run the linter |
| `bun run db:generate` | Generate the Prisma client |
| `bun run db:migrate` | Run Prisma migrations locally |
| `bun run db:push` | Push the Prisma schema to the database |

Run these from `Interval/contract`:

| Command | Description |
| --- | --- |
| `anchor build` | Build the Anchor program |
| `anchor test` | Run the contract test suite |

## Key App Areas

- `/` - Landing page
- `/explore` - Creator discovery
- `/explore/[username]` - Public creator profile
- `/dashboard` - Creator dashboard
- `/dashboard/onboarding` - Creator onboarding
- `/profile` - User profile and account area
- `/booking/[id]` - Confirmed booking access

## Development Notes

- Keep user-facing flows clean and creator-focused. Payment providers, wallet services and infrastructure details should stay behind the product experience unless a user needs to act on them.
- Treat the contract as the source of truth for escrow state and authorization rules.
- Treat the database as the source of truth for product metadata, creator presentation, booking details and app-level user experience.
- Prisma migrations live in `Interval/frontend/prisma/migrations`.
- Public media assets live in `Interval/frontend/public`.
- API routes live under `Interval/frontend/src/app/api`.
- Shared frontend utilities live under `Interval/frontend/src/lib`.

## Vision

Interval is designed to make access feel direct, credible and native to the crypto audience it serves. The goal is not just to schedule calls, but to create a trusted marketplace where creators can monetize attention and users can book meaningful time without friction.
