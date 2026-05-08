import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { NextResponse } from "next/server";
import {
  buildInitializeTreasuryInstruction,
  buildOnboardCreatorInstruction,
  findCreatorProfilePda,
  findPlatformPda,
  findTreasuryPda,
  getIntervalPlatformAdminWallet,
} from "@/lib/interval-program";
import { decodePrivateKey } from "@/lib/privy-wallet-server";
import { confirmSignatureWithPolling } from "@/lib/solana-confirmation";
import { getSelectedSolanaNetwork, getSolanaRpcUrl } from "@/lib/solana-config";

const DEFAULT_ONBOARDING_LAMPORTS = 50_000_000;
const TREASURY_TOP_UP_BUFFER_LAMPORTS = 100_000_000;

type OnchainOnboardRequest = { wallet?: string };
type FinalizeOnchainOnboardRequest = {
  wallet?: string;
  transaction?: string;
  lastValidBlockHeight?: number;
};

function getAdminKeypair() {
  const secret =
    process.env.INTERVAL_PLATFORM_ADMIN_SECRET_KEY?.trim() ||
    process.env.INTERVAL_PLATFORM_ADMIN_PRIVATE_KEY?.trim() ||
    "";

  if (!secret) {
    throw new Error(
      "Platform admin secret key is missing. Set INTERVAL_PLATFORM_ADMIN_SECRET_KEY."
    );
  }

  const admin = Keypair.fromSecretKey(decodePrivateKey(secret));
  const configuredAdminWallet = getIntervalPlatformAdminWallet();

  if (configuredAdminWallet && configuredAdminWallet !== admin.publicKey.toBase58()) {
    throw new Error(
      "Configured admin wallet does not match INTERVAL_PLATFORM_ADMIN_SECRET_KEY."
    );
  }

  return admin;
}

function getOnboardingLamports() {
  const parsed = Number(process.env.INTERVAL_CREATOR_ONBOARDING_LAMPORTS ?? "");
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return DEFAULT_ONBOARDING_LAMPORTS;
}

async function sendAndConfirm(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[]
) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.sign(...signers);

  const signature = await connection.sendRawTransaction(transaction.serialize());
  await confirmSignatureWithPolling({
    connection,
    signature,
    lastValidBlockHeight,
    commitment: "confirmed",
  });

  return signature;
}

async function ensureTreasuryReady(connection: Connection, admin: Keypair, onboardingLamports: number) {
  const treasury = findTreasuryPda();
  const treasuryAccount = await connection.getAccountInfo(treasury, "confirmed");

  if (!treasuryAccount) {
    const initializeTx = new Transaction().add(
      await buildInitializeTreasuryInstruction(admin.publicKey)
    );
    initializeTx.feePayer = admin.publicKey;
    await sendAndConfirm(connection, initializeTx, [admin]);
  }

  const currentLamports = await connection.getBalance(treasury, "confirmed");
  const rentExemptMinimum = await connection.getMinimumBalanceForRentExemption(9);
  const desiredLamports =
    rentExemptMinimum + onboardingLamports + TREASURY_TOP_UP_BUFFER_LAMPORTS;

  if (currentLamports >= desiredLamports) {
    return { treasury };
  }

  const topUpTx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: admin.publicKey,
      toPubkey: treasury,
      lamports: desiredLamports - currentLamports,
    })
  );
  topUpTx.feePayer = admin.publicKey;
  await sendAndConfirm(connection, topUpTx, [admin]);

  return { treasury };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as OnchainOnboardRequest;
    const wallet = body.wallet?.trim();

    if (!wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    const authority = new PublicKey(wallet);
    const admin = getAdminKeypair();
    const network = getSelectedSolanaNetwork(req.headers.get("cookie"));
    const connection = new Connection(getSolanaRpcUrl(network), "confirmed");
    const creatorProfile = findCreatorProfilePda(authority);
    const existingCreatorProfile = await connection.getAccountInfo(creatorProfile, "confirmed");

    if (existingCreatorProfile) {
      return NextResponse.json({
        alreadyOnchain: true,
        prepared: false,
        created: false,
        funded: false,
        signature: null,
      });
    }

    const platform = findPlatformPda();
    const platformAccount = await connection.getAccountInfo(platform, "confirmed");
    if (!platformAccount) {
      return NextResponse.json(
        { error: "Interval platform is not initialized on-chain." },
        { status: 400 }
      );
    }

    const onboardingLamports = getOnboardingLamports();
    const { treasury } = await ensureTreasuryReady(connection, admin, onboardingLamports);

    const tx = new Transaction().add(
      await buildOnboardCreatorInstruction({
        admin: admin.publicKey,
        authority,
        onboardingAmountLamports: BigInt(onboardingLamports),
      })
    );
    tx.feePayer = admin.publicKey;
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;

    return NextResponse.json({
      alreadyOnchain: false,
      prepared: true,
      created: false,
      funded: false,
      transaction: Buffer.from(
        tx.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        })
      ).toString("base64"),
      blockhash,
      lastValidBlockHeight,
      lamportsFunded: onboardingLamports,
      treasury: treasury.toBase58(),
    });
  } catch (err) {
    console.error("On-chain creator onboarding error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to onboard creator on-chain",
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as FinalizeOnchainOnboardRequest;
    const wallet = body.wallet?.trim();
    const serializedTransaction = body.transaction?.trim();
    const lastValidBlockHeight = body.lastValidBlockHeight;

    if (!wallet || !serializedTransaction || !lastValidBlockHeight) {
      return NextResponse.json(
        { error: "wallet, transaction, and lastValidBlockHeight are required" },
        { status: 400 }
      );
    }

    const authority = new PublicKey(wallet);
    const admin = getAdminKeypair();
    const network = getSelectedSolanaNetwork(req.headers.get("cookie"));
    const connection = new Connection(getSolanaRpcUrl(network), "confirmed");
    const creatorProfile = findCreatorProfilePda(authority);
    const existingCreatorProfile = await connection.getAccountInfo(creatorProfile, "confirmed");

    if (existingCreatorProfile) {
      return NextResponse.json({
        alreadyOnchain: true,
        confirmed: true,
        signature: null,
      });
    }

    const tx = Transaction.from(Buffer.from(serializedTransaction, "base64"));

    if (!tx.feePayer?.equals(admin.publicKey)) {
      return NextResponse.json(
        { error: "Sponsored onboarding transaction has an invalid fee payer." },
        { status: 400 }
      );
    }

    const authoritySigned = tx.signatures.some(
      ({ publicKey, signature }) => publicKey.equals(authority) && signature !== null
    );

    if (!authoritySigned) {
      return NextResponse.json(
        { error: "Creator onboarding transaction is missing the creator signature." },
        { status: 400 }
      );
    }

    tx.partialSign(admin);
    const signature = await connection.sendRawTransaction(tx.serialize());
    await confirmSignatureWithPolling({
      connection,
      signature,
      lastValidBlockHeight,
      commitment: "confirmed",
    });

    return NextResponse.json({
      alreadyOnchain: false,
      confirmed: true,
      signature,
    });
  } catch (err) {
    console.error("Finalize on-chain creator onboarding error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to finalize creator onboarding on-chain",
      },
      { status: 500 }
    );
  }
}
