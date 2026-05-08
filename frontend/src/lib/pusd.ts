"use client";

import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { PublicKey, Transaction } from "@solana/web3.js";
import bs58 from "bs58";
import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";
import {
  getPusdMintPublicKey,
  getSelectedSolanaWalletChain,
  type SolanaWalletChain,
} from "@/lib/solana-config";

export const PUSD_MINT = getPusdMintPublicKey();

type SignAndSendTransaction = (args: {
  transaction: Uint8Array;
  wallet: ConnectedStandardSolanaWallet;
  chain: SolanaWalletChain;
}) => Promise<{ signature: Uint8Array }>;

type WalletBalances = {
  pusdTokenAccountExists?: boolean;
};

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

export async function ensurePusdTokenAccount({
  wallet,
  walletAddress,
  signAndSendTransaction,
}: {
  wallet: ConnectedStandardSolanaWallet;
  walletAddress: string;
  signAndSendTransaction: SignAndSendTransaction;
}) {
  if (!PUSD_MINT) {
    return { created: false, signature: null as string | null, skipped: true };
  }

  const balanceData = await fetchJson<WalletBalances>(
    `/api/user/balances?wallet=${encodeURIComponent(walletAddress)}`
  );

  if (balanceData.pusdTokenAccountExists) {
    return { created: false, signature: null as string | null };
  }

  const owner = new PublicKey(walletAddress);
  const ata = await getAssociatedTokenAddress(PUSD_MINT, owner);
  const latestBlockhash = await fetchJson<{
    blockhash: string;
    lastValidBlockHeight: number;
  }>("/api/solana/blockhash");

  const transaction = new Transaction();
  transaction.add(
    createAssociatedTokenAccountInstruction(owner, ata, owner, PUSD_MINT)
  );
  transaction.feePayer = owner;
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
    throw new Error("PUSD account setup was submitted, but no signature was returned.");
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

  return { created: true, signature };
}
