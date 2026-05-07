import { Connection, PublicKey, SystemProgram, Transaction, TransactionInstruction } from "@solana/web3.js";
import bs58 from "bs58";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import { SOLANA_RPC_URL, SOLANA_WALLET_CHAIN, type SolanaWalletChain } from "@/lib/solana-config";

export const INTERVAL_PROGRAM_ID = new PublicKey("4ATtXLmT25nh447GjP9BtdWJudN8uuqcNNmawRWexfx6");

const PLATFORM_SEED = "platform";
const TREASURY_SEED = "treasury";
const CREATOR_SEED = "creator";
const BOOKING_SEED = "booking";
const INITIALIZE_PLATFORM_DISCRIMINATOR = Uint8Array.from([119, 201, 101, 45, 75, 122, 89, 3]);
const INITIALIZE_TREASURY_DISCRIMINATOR = Uint8Array.from([124, 186, 211, 195, 85, 165, 129, 166]);
const REGISTER_CREATOR_DISCRIMINATOR = Uint8Array.from([85, 3, 194, 210, 164, 140, 160, 195]);
const ONBOARD_CREATOR_DISCRIMINATOR = Uint8Array.from([226, 92, 121, 226, 126, 161, 140, 30]);
const BOOK_SLOT_DISCRIMINATOR = Uint8Array.from([233, 227, 65, 37, 70, 197, 216, 39]);
type SignAndSendTransaction = (args: {
  transaction: Uint8Array;
  wallet: ConnectedStandardSolanaWallet;
  chain: SolanaWalletChain;
}) => Promise<{ signature: Uint8Array }>;

type ConfirmedBlockhash = {
  blockhash: string;
  lastValidBlockHeight: number;
};

type ProgramDeployment = {
  executable: boolean;
  owner: PublicKey;
};

export class IntervalTransactionError extends Error {
  signature?: string;

  constructor(message: string, signature?: string) {
    super(message);
    this.name = "IntervalTransactionError";
    this.signature = signature;
  }
}

function signatureToString(signature: string | Uint8Array | undefined) {
  if (!signature) return "";
  return typeof signature === "string" ? signature : bs58.encode(signature);
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(
      typeof data?.error === "string" ? data.error : `Request failed: ${url}`
    );
  }

  return data as T;
}

function getReadConnection() {
  return new Connection(SOLANA_RPC_URL, "confirmed");
}

async function ensureFeePayerCanCoverFees(connection: Connection, feePayer: PublicKey) {
  const feePayerBalance = await connection.getBalance(feePayer, "confirmed");
  if (feePayerBalance > 0) {
    return;
  }

  throw new Error(
    `Wallet ${feePayer.toBase58()} has no SOL on the configured RPC. This transaction cannot be sent from the wallet directly. Use the sponsored admin onboarding flow instead.`
  );
}

async function getProgramDeployment() {
  const account = await getReadConnection().getAccountInfo(INTERVAL_PROGRAM_ID, "confirmed");
  if (!account) {
    return null;
  }

  return {
    executable: account.executable,
    owner: account.owner,
  } satisfies ProgramDeployment;
}

async function assertProgramDeployed() {
  const deployment = await getProgramDeployment();

  if (!deployment) {
    throw new Error(
      `Interval program ${INTERVAL_PROGRAM_ID.toBase58()} was not found on the configured Solana RPC. Check that SOLANA_RPC and NEXT_PUBLIC_SOLANA_RPC point to the network where the program is deployed.`
    );
  }

  if (!deployment.executable) {
    throw new Error(
      `Interval program ${INTERVAL_PROGRAM_ID.toBase58()} exists on the configured Solana RPC, but it is not executable. Verify the deployed program id and RPC network.`
    );
  }
}

function encodeU64(value: bigint) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigUint64(0, value, true);
  return bytes;
}

function encodeI64(value: bigint) {
  const bytes = new Uint8Array(8);
  const view = new DataView(bytes.buffer);
  view.setBigInt64(0, value, true);
  return bytes;
}

function concatBytes(...parts: Uint8Array[]) {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

export function findPlatformPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(PLATFORM_SEED)],
    INTERVAL_PROGRAM_ID
  )[0];
}

export function findTreasuryPda() {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(TREASURY_SEED)],
    INTERVAL_PROGRAM_ID
  )[0];
}

export function getIntervalPlatformAdminWallet() {
  return process.env.NEXT_PUBLIC_INTERVAL_PLATFORM_ADMIN_WALLET?.trim() || null;
}

export function canInitializeIntervalPlatform(walletAddress: string | null) {
  if (!walletAddress) return false;
  const configuredAdminWallet = getIntervalPlatformAdminWallet();
  if (!configuredAdminWallet) {
    return true;
  }
  return configuredAdminWallet === walletAddress;
}

export function findCreatorProfilePda(authority: PublicKey) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(CREATOR_SEED), authority.toBuffer()],
    INTERVAL_PROGRAM_ID
  )[0];
}

export function findBookingEscrowPda(bookingId: Uint8Array) {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(BOOKING_SEED), Buffer.from(bookingId)],
    INTERVAL_PROGRAM_ID
  )[0];
}

export async function deriveSlotHash(slotId: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`interval-slot:${slotId}`)
  );
  return new Uint8Array(digest);
}

export async function deriveBookingId(slotId: string, payerWallet: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`interval-booking:${slotId}:${payerWallet}`)
  );
  return new Uint8Array(digest);
}

export function bookingIdToHex(bookingId: Uint8Array) {
  return Array.from(bookingId, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function isCreatorRegisteredOnChain(walletAddress: string) {
  await assertProgramDeployed();
  const authority = new PublicKey(walletAddress);
  const creatorProfile = findCreatorProfilePda(authority);
  const account = await getReadConnection().getAccountInfo(creatorProfile, "confirmed");
  return Boolean(account);
}

export async function isIntervalPlatformInitialized() {
  await assertProgramDeployed();
  const platform = findPlatformPda();
  const account = await getReadConnection().getAccountInfo(platform, "confirmed");
  return Boolean(account);
}

async function assertPlatformInitialized() {
  await assertProgramDeployed();
  const platform = findPlatformPda();
  const account = await getReadConnection().getAccountInfo(platform, "confirmed");

  if (!account) {
    throw new Error("Interval platform is not initialized on-chain.");
  }

  return platform;
}

async function sendAndConfirmTransaction({
  wallet,
  signAndSendTransaction,
  transaction,
  feePayer,
}: {
  wallet: ConnectedStandardSolanaWallet;
  signAndSendTransaction: SignAndSendTransaction;
  transaction: Transaction;
  feePayer: PublicKey;
}) {
  const connection = getReadConnection();
  await ensureFeePayerCanCoverFees(connection, feePayer);

  const latestBlockhash = await fetchJson<ConfirmedBlockhash>("/api/solana/blockhash");
  transaction.feePayer = feePayer;
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  let result: { signature: Uint8Array };
  try {
    result = await signAndSendTransaction({
      transaction: new Uint8Array(serialized),
      wallet,
      chain: SOLANA_WALLET_CHAIN,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const isGenericWalletFailure =
      message.trim() === "Something went wrong." ||
      message.trim() === "Please try again." ||
      message.includes("Something went wrong");

    if (isGenericWalletFailure) {
      throw new Error(
        "Wallet submission failed before the transaction landed. This usually means the connected wallet/RPC network does not match the deployed Interval program, or the wallet does not have enough SOL for fees."
      );
    }

    throw error;
  }
  const signature = signatureToString(result.signature);

  if (!signature) {
    throw new Error("Transaction submitted, but no signature was returned.");
  }

  try {
    await fetchJson<{ confirmed: boolean }>("/api/solana/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        signature,
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      }),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Transaction failed to confirm";
    throw new IntervalTransactionError(message, signature);
  }

  return signature;
}

export async function buildRegisterCreatorInstruction(authority: PublicKey) {
  const platform = await assertPlatformInitialized();
  const creatorProfile = findCreatorProfilePda(authority);

  return new TransactionInstruction({
    programId: INTERVAL_PROGRAM_ID,
    keys: [
      { pubkey: platform, isSigner: false, isWritable: false },
      { pubkey: creatorProfile, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(REGISTER_CREATOR_DISCRIMINATOR),
  });
}

export async function buildInitializePlatformInstruction(admin: PublicKey) {
  await assertProgramDeployed();
  const platform = findPlatformPda();

  return new TransactionInstruction({
    programId: INTERVAL_PROGRAM_ID,
    keys: [
      { pubkey: platform, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(INITIALIZE_PLATFORM_DISCRIMINATOR),
  });
}

export async function buildInitializeTreasuryInstruction(admin: PublicKey) {
  const platform = await assertPlatformInitialized();
  const treasury = findTreasuryPda();

  return new TransactionInstruction({
    programId: INTERVAL_PROGRAM_ID,
    keys: [
      { pubkey: platform, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(INITIALIZE_TREASURY_DISCRIMINATOR),
  });
}

export async function initializeIntervalPlatform({
  wallet,
  walletAddress,
  signAndSendTransaction,
}: {
  wallet: ConnectedStandardSolanaWallet;
  walletAddress: string;
  signAndSendTransaction: SignAndSendTransaction;
}) {
  if (!canInitializeIntervalPlatform(walletAddress)) {
    throw new Error("This wallet is not allowed to initialize the Interval platform.");
  }

  const alreadyInitialized = await isIntervalPlatformInitialized();
  if (alreadyInitialized) {
    return { created: false, signature: null as string | null };
  }

  const admin = new PublicKey(walletAddress);
  const transaction = new Transaction();
  transaction.add(await buildInitializePlatformInstruction(admin));

  const signature = await sendAndConfirmTransaction({
    wallet,
    signAndSendTransaction,
    transaction,
    feePayer: admin,
  });

  return { created: true, signature };
}

export async function ensureIntervalCreatorProfile({
  wallet,
  walletAddress,
  signAndSendTransaction,
}: {
  wallet: ConnectedStandardSolanaWallet;
  walletAddress: string;
  signAndSendTransaction: SignAndSendTransaction;
}) {
  await assertPlatformInitialized();

  const authority = new PublicKey(walletAddress);
  const creatorProfile = findCreatorProfilePda(authority);
  const existingCreatorProfile = await getReadConnection().getAccountInfo(
    creatorProfile,
    "confirmed"
  );

  if (existingCreatorProfile) {
    return { created: false, signature: null as string | null };
  }

  const transaction = new Transaction();
  transaction.add(await buildRegisterCreatorInstruction(authority));
  const signature = await sendAndConfirmTransaction({
    wallet,
    signAndSendTransaction,
    transaction,
    feePayer: authority,
  });

  return { created: true, signature };
}

export async function buildOnboardCreatorInstruction({
  admin,
  authority,
  onboardingAmountLamports,
}: {
  admin: PublicKey;
  authority: PublicKey;
  onboardingAmountLamports: bigint;
}) {
  const platform = await assertPlatformInitialized();
  const treasury = findTreasuryPda();
  const creatorProfile = findCreatorProfilePda(authority);

  return new TransactionInstruction({
    programId: INTERVAL_PROGRAM_ID,
    keys: [
      { pubkey: platform, isSigner: false, isWritable: false },
      { pubkey: treasury, isSigner: false, isWritable: true },
      { pubkey: creatorProfile, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(
      concatBytes(
        ONBOARD_CREATOR_DISCRIMINATOR,
        encodeU64(onboardingAmountLamports)
      )
    ),
  });
}

export async function buildBookSlotInstruction({
  slotId,
  payerWallet,
  creatorWallet,
  amountLamports,
  scheduledEndTime,
}: {
  slotId: string;
  payerWallet: string;
  creatorWallet: string;
  amountLamports: bigint;
  scheduledEndTime: number;
}) {
  const platform = await assertPlatformInitialized();
  const buyer = new PublicKey(payerWallet);
  const creator = new PublicKey(creatorWallet);
  const creatorProfile = findCreatorProfilePda(creator);
  const creatorProfileAccount = await getReadConnection().getAccountInfo(
    creatorProfile,
    "confirmed"
  );

  if (!creatorProfileAccount) {
    throw new Error("This creator is not registered on-chain yet.");
  }

  const bookingId = await deriveBookingId(slotId, payerWallet);
  const bookingEscrow = findBookingEscrowPda(bookingId);
  const slotHash = await deriveSlotHash(slotId);
  const data = concatBytes(
    BOOK_SLOT_DISCRIMINATOR,
    bookingId,
    slotHash,
    encodeU64(amountLamports),
    encodeI64(BigInt(scheduledEndTime))
  );

  return {
    bookingId,
    bookingEscrow,
    instruction: new TransactionInstruction({
      programId: INTERVAL_PROGRAM_ID,
      keys: [
        { pubkey: platform, isSigner: false, isWritable: false },
        { pubkey: creatorProfile, isSigner: false, isWritable: false },
        { pubkey: bookingEscrow, isSigner: false, isWritable: true },
        { pubkey: buyer, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from(data),
    }),
  };
}

export async function payForSlotWithIntervalEscrow({
  wallet,
  signAndSendTransaction,
  payerWallet,
  creatorWallet,
  slotId,
  price,
  scheduledEndTime,
}: {
  wallet: ConnectedStandardSolanaWallet;
  signAndSendTransaction: SignAndSendTransaction;
  payerWallet: string;
  creatorWallet: string;
  slotId: string;
  price: number;
  scheduledEndTime: string;
}) {
  if (!payerWallet) {
    throw new Error("Connect your wallet before booking.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("This slot has an invalid price.");
  }

  const amountLamports = BigInt(Math.round(price * 1_000_000_000));
  const scheduledEndTimeUnix = Math.floor(new Date(scheduledEndTime).getTime() / 1000);

  if (!Number.isFinite(scheduledEndTimeUnix) || scheduledEndTimeUnix <= Math.floor(Date.now() / 1000)) {
    throw new Error("This slot's end time is invalid or has already passed.");
  }

  const { bookingEscrow, instruction } = await buildBookSlotInstruction({
    slotId,
    payerWallet,
    creatorWallet,
    amountLamports,
    scheduledEndTime: scheduledEndTimeUnix,
  });

  const transaction = new Transaction();
  transaction.add(instruction);

  const signature = await sendAndConfirmTransaction({
    wallet,
    signAndSendTransaction,
    transaction,
    feePayer: new PublicKey(payerWallet),
  });

  return {
    signature,
    bookingEscrow: bookingEscrow.toBase58(),
    bookingId: bookingIdToHex(await deriveBookingId(slotId, payerWallet)),
  };
}
