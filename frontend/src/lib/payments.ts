"use client";

import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import bs58 from "bs58";

export type Currency = "SOL" | "PUSD";

type SignAndSendTransaction = (args: {
  transaction: Uint8Array;
  wallet: ConnectedStandardSolanaWallet;
  chain: "solana:mainnet-beta";
}) => Promise<{ signature: Uint8Array }>;

type PayForSlotParams = {
  wallet: ConnectedStandardSolanaWallet;
  signAndSendTransaction: SignAndSendTransaction;
  payerWallet: string;
  creatorWallet: string;
  price: number;
  currency: Currency;
};

const PUSD_MINT = new PublicKey("CzzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s");
const PUSD_DECIMALS = 6;

type PaymentPreflight =
  | { lamports: number }
  | {
      userAta: string;
      creatorAta: string;
      userTokenAmount: string;
      userTokenAccountExists: boolean;
      creatorTokenAccountExists: boolean;
    };

export function formatPaymentAmount(amount: number, currency: Currency) {
  const decimals = currency === "SOL" ? 4 : 2;
  const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(decimals);
  return `${formatted} ${currency}`;
}

function toBaseUnits(amount: number, decimals: number) {
  return BigInt(Math.round(amount * 10 ** decimals));
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

export async function payForSlot({
  wallet,
  signAndSendTransaction,
  payerWallet,
  creatorWallet,
  price,
  currency,
}: PayForSlotParams): Promise<string> {
  if (!payerWallet) {
    throw new Error("Connect your wallet before booking.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("This slot has an invalid price.");
  }

  const payer = new PublicKey(payerWallet);
  const creator = new PublicKey(creatorWallet);
  const transaction = new Transaction();
  const preflight = await fetchJson<PaymentPreflight>("/api/solana/payment-preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payerWallet,
      creatorWallet,
      currency,
    }),
  });

  if (currency === "SOL") {
    const lamports = Number(toBaseUnits(price, 9));
    const balance = "lamports" in preflight ? preflight.lamports : 0;

    if (balance < lamports) {
      throw new Error(
        `Insufficient SOL. You need ${formatPaymentAmount(price, "SOL")} plus network fees.`
      );
    }

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: creator,
        lamports,
      })
    );
  } else {
    const amount = toBaseUnits(price, PUSD_DECIMALS);
    if ("lamports" in preflight) {
      throw new Error("Could not load PUSD account info. Please try again.");
    }

    const userAta = new PublicKey(preflight.userAta);
    const creatorAta = new PublicKey(preflight.creatorAta);

    if (!preflight.userTokenAccountExists) {
      throw new Error("You do not have a PUSD token account for this wallet.");
    }

    if (BigInt(preflight.userTokenAmount) < amount) {
      throw new Error(`Insufficient PUSD. You need ${formatPaymentAmount(price, "PUSD")}.`);
    }

    if (!preflight.creatorTokenAccountExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer,
          creatorAta,
          creator,
          PUSD_MINT
        )
      );
    }

    transaction.add(
      createTransferInstruction(userAta, creatorAta, payer, amount)
    );
  }

  const latestBlockhash = await fetchJson<{
    blockhash: string;
    lastValidBlockHeight: number;
  }>("/api/solana/blockhash");
  transaction.feePayer = payer;
  transaction.recentBlockhash = latestBlockhash.blockhash;

  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const result = await signAndSendTransaction({
    transaction: new Uint8Array(serialized),
    wallet,
    chain: "solana:mainnet-beta",
  });
  const signature = signatureToString(result.signature);

  if (!signature) {
    throw new Error("Transaction submitted, but no signature was returned.");
  }

  await fetchJson<{ confirmed: boolean }>("/api/solana/confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      signature,
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
    }),
  });

  return signature;
}
