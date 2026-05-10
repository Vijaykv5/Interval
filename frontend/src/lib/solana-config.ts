import { PublicKey, clusterApiUrl } from "@solana/web3.js";

export type SolanaNetwork = "devnet" | "mainnet-beta";
export type SolanaWalletChain = "solana:devnet" | "solana:mainnet";
export type KnownTokenDefinition = {
  symbol: string;
  name: string;
  decimals: number;
  mintAddress: string;
  network: SolanaNetwork;
};

export const SOLANA_NETWORK_COOKIE = "interval-network";
export const PUSD_DECIMALS = 6;
export const PUSD_SYMBOL = "PUSD";
export const PUSD_NAME = "PUSD";
export const PUSD_MAINNET_MINT = "CZzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s";

export function parseSolanaNetwork(value: string | undefined | null): SolanaNetwork {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "mainnet" || normalized === "mainnet-beta") {
    return "mainnet-beta";
  }

  return "devnet";
}

function getCookieValue(cookieHeader: string | null | undefined, key: string) {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(";").map((entry) => entry.trim());
  for (const part of parts) {
    if (part.startsWith(`${key}=`)) {
      return decodeURIComponent(part.slice(key.length + 1));
    }
  }

  return null;
}

export function getEnvSolanaNetwork(): SolanaNetwork {
  return parseSolanaNetwork(
    process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? process.env.SOLANA_NETWORK
  );
}

export function getNetworkCookieHeader(network: SolanaNetwork) {
  return `${SOLANA_NETWORK_COOKIE}=${encodeURIComponent(network)}`;
}

export function getSelectedSolanaNetwork(cookieHeader?: string | null): SolanaNetwork {
  if (typeof window !== "undefined") {
    const stored =
      window.localStorage.getItem(SOLANA_NETWORK_COOKIE) ??
      getCookieValue(document.cookie, SOLANA_NETWORK_COOKIE);
    if (stored) {
      return parseSolanaNetwork(stored);
    }
  }

  const cookieValue = getCookieValue(cookieHeader, SOLANA_NETWORK_COOKIE);
  if (cookieValue) {
    return parseSolanaNetwork(cookieValue);
  }

  return getEnvSolanaNetwork();
}

export function setSelectedSolanaNetwork(network: SolanaNetwork) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SOLANA_NETWORK_COOKIE, network);
  document.cookie = `${getNetworkCookieHeader(network)}; path=/; max-age=${
    60 * 60 * 24 * 365
  }; samesite=lax`;
}

export function getSolanaWalletChain(network: SolanaNetwork): SolanaWalletChain {
  return network === "mainnet-beta" ? "solana:mainnet" : "solana:devnet";
}

export function getSelectedSolanaWalletChain(cookieHeader?: string | null): SolanaWalletChain {
  return getSolanaWalletChain(getSelectedSolanaNetwork(cookieHeader));
}

export function getSolanaRpcUrl(
  network: SolanaNetwork = getSelectedSolanaNetwork()
): string {
  const specificPublic =
    network === "mainnet-beta"
      ? process.env.NEXT_PUBLIC_SOLANA_RPC_MAINNET?.trim()
      : process.env.NEXT_PUBLIC_SOLANA_RPC_DEVNET?.trim();
  const specificServer =
    network === "mainnet-beta"
      ? process.env.SOLANA_RPC_MAINNET?.trim()
      : process.env.SOLANA_RPC_DEVNET?.trim();
  const legacyPublic = process.env.NEXT_PUBLIC_SOLANA_RPC?.trim();
  const legacyServer = process.env.SOLANA_RPC?.trim();

  if (specificPublic) return specificPublic;
  if (specificServer) return specificServer;

  const envNetwork = getEnvSolanaNetwork();
  if (legacyPublic && envNetwork === network) return legacyPublic;
  if (legacyServer && envNetwork === network) return legacyServer;

  return clusterApiUrl(network);
}

export function getSolanaWsUrl(
  network: SolanaNetwork = getSelectedSolanaNetwork()
): string {
  const specificPublic =
    network === "mainnet-beta"
      ? process.env.NEXT_PUBLIC_SOLANA_WS_MAINNET?.trim()
      : process.env.NEXT_PUBLIC_SOLANA_WS_DEVNET?.trim();
  const legacyPublic = process.env.NEXT_PUBLIC_SOLANA_WS?.trim();

  if (specificPublic) return specificPublic;

  const envNetwork = getEnvSolanaNetwork();
  if (legacyPublic && envNetwork === network) return legacyPublic;

  const rpcUrl = getSolanaRpcUrl(network);
  return rpcUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");
}

export function getPusdMintAddress(
  network: SolanaNetwork = getSelectedSolanaNetwork()
): string {
  if (network === "mainnet-beta") {
    const configuredMainnetMint =
      process.env.NEXT_PUBLIC_PUSD_MINT_MAINNET?.trim() ??
      process.env.PUSD_MINT_MAINNET?.trim();

    if (configuredMainnetMint) {
      return configuredMainnetMint;
    }

    return PUSD_MAINNET_MINT;
  }

  const specificPublic =
    process.env.NEXT_PUBLIC_PUSD_MINT_DEVNET?.trim();
  const specificServer =
    process.env.PUSD_MINT_DEVNET?.trim();
  const legacyPublic = process.env.NEXT_PUBLIC_PUSD_MINT?.trim();
  const legacyServer = process.env.PUSD_MINT?.trim();

  if (specificPublic) return specificPublic;
  if (specificServer) return specificServer;

  const envNetwork = getEnvSolanaNetwork();
  if (legacyPublic && envNetwork === network) return legacyPublic;
  if (legacyServer && envNetwork === network) return legacyServer;

  return "";
}

export function hasConfiguredPusdMint(
  network: SolanaNetwork = getSelectedSolanaNetwork()
) {
  return getPusdMintAddress(network).length > 0;
}

export function getPusdMintPublicKey(
  network: SolanaNetwork = getSelectedSolanaNetwork()
) {
  const mintAddress = getPusdMintAddress(network);
  if (!mintAddress) {
    return null;
  }

  return new PublicKey(mintAddress);
}

export function getPusdTokenDefinition(
  network: SolanaNetwork = getSelectedSolanaNetwork()
): KnownTokenDefinition | null {
  const mintAddress = getPusdMintAddress(network);
  if (!mintAddress) {
    return null;
  }

  return {
    symbol: PUSD_SYMBOL,
    name: PUSD_NAME,
    decimals: PUSD_DECIMALS,
    mintAddress,
    network,
  };
}

export function isDevnetNetwork(network: SolanaNetwork = getSelectedSolanaNetwork()) {
  return network === "devnet";
}

export function getExplorerClusterParam(
  network: SolanaNetwork = getSelectedSolanaNetwork()
) {
  return network === "devnet" ? "devnet" : null;
}

export function getExplorerTransactionUrl(
  signature: string,
  network: SolanaNetwork = getSelectedSolanaNetwork()
) {
  const cluster = getExplorerClusterParam(network);
  const baseUrl = `https://explorer.solana.com/tx/${signature}`;
  return cluster ? `${baseUrl}?cluster=${cluster}` : baseUrl;
}

export const SOLANA_NETWORK: SolanaNetwork = getEnvSolanaNetwork();
export const SOLANA_WALLET_CHAIN: SolanaWalletChain = getSolanaWalletChain(SOLANA_NETWORK);
export const SOLANA_RPC_URL = getSolanaRpcUrl(SOLANA_NETWORK);
export const SOLANA_WS_URL = getSolanaWsUrl(SOLANA_NETWORK);
export const PUSD_MINT_ADDRESS = getPusdMintAddress(SOLANA_NETWORK);
