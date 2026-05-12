# Interval Smart Contract

Anchor program for Interval's Solana-native creator booking flow. The contract keeps the critical lifecycle verifiable on-chain: platform setup, creator registration, treasury-backed creator onboarding, booking escrow funding, release, and refund.

## Program

```text
Program ID: 4ATtXLmT25nh447GjP9BtdWJudN8uuqcNNmawRWexfx6
```

The workspace is configured for `localnet` in `Anchor.toml`. The same program ID is used by the app when deriving Interval PDAs.

## Structure

```text
contract/
  Anchor.toml
  programs/interval/
    src/
      lib.rs              Program entrypoint
      instructions/mod.rs Instruction handlers and account validation
      state/mod.rs        Account structs and booking status enum
      constants.rs        PDA seed constants
      errors.rs           Custom Anchor errors
  scripts/
    init-platform.js      Platform initialization helper
  tests/
    interval.test.cjs     Anchor integration tests
```

## Accounts

| Account | PDA seeds | Purpose |
| --- | --- | --- |
| `Platform` | `["platform"]` | Stores platform admin, pause state, and bump. |
| `Treasury` | `["treasury"]` | Holds platform-managed SOL for sponsored creator onboarding. |
| `CreatorProfile` | `["creator", authority]` | Marks a creator wallet as active on Interval. |
| `BookingEscrow` | `["booking", booking_id]` | Holds SOL for a booked slot until release or refund. |

## Instructions

| Instruction | Signer | What it does |
| --- | --- | --- |
| `initialize_platform()` | `admin` | Creates the singleton platform PDA and records the admin wallet. |
| `initialize_treasury()` | `admin` | Creates the treasury PDA. Requires the platform admin. |
| `register_creator()` | `authority` | Creates an active creator profile for the signing creator wallet. |
| `onboard_creator(onboarding_amount)` | `admin`, `authority` | Creates a creator profile and transfers SOL from treasury to the creator. |
| `book_slot(booking_id, slot_hash, amount, scheduled_end_time)` | `buyer` | Creates a booking escrow and transfers `amount` lamports from buyer into it. |
| `release_funds()` | `creator authority` | Releases escrowed SOL to the creator after `scheduled_end_time`. |
| `refund_booking()` | `creator authority` or `platform admin` | Refunds escrowed SOL to the buyer while booking is still funded. |

## Booking Lifecycle

1. Platform is initialized by the admin.
2. Treasury is initialized and optionally funded with SOL.
3. Creator registers directly, or is onboarded by the admin through treasury sponsorship.
4. Buyer books a slot by funding a `BookingEscrow` PDA.
5. After the scheduled end time, the creator can release funds.
6. Before release, an authorized creator/admin can refund the buyer.

Booking status values are:

```text
Funded -> Released
Funded -> Refunded
```

Released and refunded escrows are closed back to the buyer account after lamports are moved.

## Local Setup

Install the Solana and Anchor toolchains, then run from this folder:

```bash
anchor build
anchor test
```

The test validator is configured in `Anchor.toml`:

```text
RPC port: 8897
Wallet: ~/.config/solana/id.json
Cluster: localnet
```

The test script uses the frontend dependency tree for Anchor JS:

```text
NODE_PATH=../frontend/node_modules node --test tests/*.cjs
```

If dependencies are missing, install the frontend first:

```bash
cd ../frontend
bun install
cd ../contract
anchor test
```

## Useful Commands

| Command | Description |
| --- | --- |
| `anchor build` | Compile the program and generate the IDL. |
| `anchor test` | Start a local validator and run the integration suite. |
| `anchor keys list` | Show declared program addresses. |
| `anchor deploy` | Deploy the program to the configured provider cluster. |
| `solana address` | Show the active Solana CLI wallet address. |
| `solana balance` | Show the active wallet balance. |

## PDA Reference

```ts
const [platformPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("platform")],
  programId
);

const [treasuryPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("treasury")],
  programId
);

const [creatorProfilePda] = PublicKey.findProgramAddressSync(
  [Buffer.from("creator"), creatorWallet.toBuffer()],
  programId
);

const [bookingEscrowPda] = PublicKey.findProgramAddressSync(
  [Buffer.from("booking"), Buffer.from(bookingId)],
  programId
);
```

`bookingId` and `slotHash` are fixed 32-byte arrays. The frontend should derive these deterministically from app-level booking and slot metadata.

## Security Notes

- `amount` must be greater than zero.
- `scheduled_end_time` must be in the future when the booking is created.
- Creator profiles must be active before bookings can be funded.
- Funds can only be released after the scheduled end time.
- Refunds require either the creator authority or platform admin.
- Platform pause state blocks creator registration, onboarding, booking, and release paths.

## Frontend Integration Notes

- Keep rich product metadata in the database: creator display data, slot text, meeting links, email state, and payment provider metadata.
- Keep escrow-critical values on-chain: buyer, creator, amount, booking ID, slot hash, scheduled end time, and status.
- Always confirm transactions before updating user-facing booking state.
- Treat the generated Anchor IDL at `target/idl/interval.json` as the contract interface artifact after `anchor build`.
