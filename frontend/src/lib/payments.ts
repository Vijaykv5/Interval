"use client";

import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
} from "@solana/spl-token";
import {
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { payForSlotWithIntervalEscrow } from "@/lib/interval-program";
import {
  getPusdMintPublicKey,
  PUSD_DECIMALS,
  getSelectedSolanaNetwork,
  getSelectedSolanaWalletChain,
} from "@/lib/solana-config";
import type {
  IntervalSignAndSendTransaction,
  IntervalSolanaWallet,
} from "@/lib/solana-wallet";

export type Currency = "SOL" | "PUSD";

type PayForSlotParams<TWallet extends IntervalSolanaWallet> = {
  wallet: TWallet;
  signAndSendTransaction: IntervalSignAndSendTransaction<TWallet>;
  payerWallet: string;
  creatorWallet: string;
  slotId?: string;
  scheduledEndTime?: string;
  price: number;
  currency: Currency;
};

type PaymentPreflight =
  | { lamports: number }
  | {
      userAta: string;
      creatorAta: string;
      userTokenAmount: string;
      userTokenTotalAmount: string;
      userTokenAccountExists: boolean;
      userSourceTokenAccount: string;
      userSourceTokenAmount: string;
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

export async function payForSlot<TWallet extends IntervalSolanaWallet>({
  wallet,
  signAndSendTransaction,
  payerWallet,
  creatorWallet,
  slotId,
  scheduledEndTime,
  price,
  currency,
}: PayForSlotParams<TWallet>): Promise<string> {
  if (!payerWallet) {
    throw new Error("Connect your wallet before booking.");
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("This slot has an invalid price.");
  }

  const payer = new PublicKey(payerWallet);
  const creator = new PublicKey(creatorWallet);
  const preflight = await fetchJson<PaymentPreflight>("/api/solana/payment-preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      payerWallet,
      creatorWallet,
      currency,
      amount: currency === "PUSD" ? price : undefined,
    }),
  });

  if (currency === "SOL") {
    if (!slotId || !scheduledEndTime) {
      throw new Error("Missing slot metadata for on-chain SOL escrow booking.");
    }

    const lamports = toBaseUnits(price, 9);
    const balance = "lamports" in preflight ? preflight.lamports : 0;

    if (BigInt(balance) < lamports) {
      throw new Error(
        `Insufficient SOL. You need ${formatPaymentAmount(price, "SOL")} plus network fees.`
      );
    }

    const result = await payForSlotWithIntervalEscrow({
      wallet,
      signAndSendTransaction,
      payerWallet,
      creatorWallet,
      slotId,
      price,
      scheduledEndTime,
    });

    return result.signature;
  } else {
    const network = getSelectedSolanaNetwork();
    const pusdMint = getPusdMintPublicKey(network);

    if (!pusdMint) {
      const envSuffix = network === "mainnet-beta" ? "MAINNET" : "DEVNET";
      throw new Error(
        `PUSD is not configured for ${network}. Set NEXT_PUBLIC_PUSD_MINT_${envSuffix} and PUSD_MINT_${envSuffix} in frontend/.env.local, then restart the app.`
      );
    }

    const transaction = new Transaction();
    const amount = toBaseUnits(price, PUSD_DECIMALS);
    if ("lamports" in preflight) {
      throw new Error("Could not load PUSD account info. Please try again.");
    }

    const userSourceTokenAccount = new PublicKey(preflight.userSourceTokenAccount);
    const creatorAta = new PublicKey(preflight.creatorAta);

    if (!preflight.userTokenAccountExists) {
      throw new Error("You do not have a PUSD token account for this wallet.");
    }

    if (BigInt(preflight.userTokenTotalAmount) < amount) {
      throw new Error(`Insufficient PUSD. You need ${formatPaymentAmount(price, "PUSD")}.`);
    }

    if (BigInt(preflight.userSourceTokenAmount) < amount) {
      throw new Error("Your PUSD balance is spread across multiple token accounts. Please consolidate it into one account and try again.");
    }

    if (!preflight.creatorTokenAccountExists) {
      transaction.add(
        createAssociatedTokenAccountInstruction(
          payer,
          creatorAta,
          creator,
          pusdMint
        )
      );
    }

    transaction.add(
      createTransferInstruction(userSourceTokenAccount, creatorAta, payer, amount)
    );

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
      chain: getSelectedSolanaWalletChain(),
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
}
