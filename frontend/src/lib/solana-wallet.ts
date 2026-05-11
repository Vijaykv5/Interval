import type { SolanaWalletChain } from "@/lib/solana-config";

export type IntervalSolanaWallet = {
  address: string;
};

export type IntervalSignAndSendTransaction<TWallet = IntervalSolanaWallet> = (args: {
  transaction: Uint8Array;
  wallet: TWallet;
  chain: SolanaWalletChain;
}) => Promise<{ signature: Uint8Array }>;
