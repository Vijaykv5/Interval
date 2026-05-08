import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export type SolanaNetwork = "devnet" | "mainnet-beta";
export type SolanaWalletChain = "solana:devnet" | "solana:mainnet";

function parseSolanaNetwork(value: string | undefined): SolanaNetwork {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "mainnet-beta") {
    return "mainnet-beta";
  }

  return "devnet";
}

export const SOLANA_NETWORK: SolanaNetwork = parseSolanaNetwork(
  process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? process.env.SOLANA_NETWORK
);

export const SOLANA_WALLET_CHAIN: SolanaWalletChain =
  SOLANA_NETWORK === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  process.env.SOLANA_RPC ??
  clusterApiUrl(SOLANA_NETWORK);

export const SOLANA_WS_URL =
  process.env.NEXT_PUBLIC_SOLANA_WS ?? "";

export const PUSD_DECIMALS = 6;

export const PUSD_MINT_ADDRESS =
  process.env.NEXT_PUBLIC_PUSD_MINT ??
  process.env.PUSD_MINT ??
  "";

export function isDevnetNetwork() {
  return SOLANA_NETWORK === "devnet";
}

export function hasConfiguredPusdMint() {
  return PUSD_MINT_ADDRESS.length > 0;
}

export function getPusdMintPublicKey() {
  if (!hasConfiguredPusdMint()) {
    return null;
  }

  return new PublicKey(PUSD_MINT_ADDRESS);
}

export function getExplorerClusterParam() {
  return SOLANA_NETWORK === "devnet" ? "devnet" : null;
}

export function getExplorerTransactionUrl(signature: string) {
  const cluster = getExplorerClusterParam();
  const baseUrl = `https://explorer.solana.com/tx/${signature}`;
  return cluster ? `${baseUrl}?cluster=${cluster}` : baseUrl;
}
