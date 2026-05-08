"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { ReactNode } from "react";
import { getSolanaRpcUrl, getSolanaWsUrl } from "@/lib/solana-config";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? undefined;
const mainnetRpcUrl = getSolanaRpcUrl("mainnet-beta");
const devnetRpcUrl = getSolanaRpcUrl("devnet");
const mainnetWsUrl = getSolanaWsUrl("mainnet-beta");
const devnetWsUrl = getSolanaWsUrl("devnet");

const solanaConnectors = toSolanaWalletConnectors();
const solanaRpcs = {
  "solana:mainnet": {
    rpc: createSolanaRpc(mainnetRpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(mainnetWsUrl),
    blockExplorerUrl: "https://explorer.solana.com",
  },
  "solana:devnet": {
    rpc: createSolanaRpc(devnetRpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(devnetWsUrl),
    blockExplorerUrl: "https://explorer.solana.com?cluster=devnet",
  },
  "solana:testnet": {
    rpc: createSolanaRpc(devnetRpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(devnetWsUrl),
    blockExplorerUrl: "https://explorer.solana.com?cluster=testnet",
  },
} as const;

export function PrivyProviders({ children }: { children: ReactNode }) {
  if (!appId) {
    return (
      <main className="flex min-h-screen items-center justify-center px-6 text-center text-white">
        <div className="max-w-md space-y-3">
          <h1 className="text-2xl font-semibold">Privy is not configured</h1>
          <p className="text-sm text-white/70">
            Add NEXT_PUBLIC_PRIVY_APP_ID to your frontend environment to enable wallet login.
          </p>
        </div>
      </main>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        solana: {
          rpcs: solanaRpcs,
        },
        embeddedWallets: {
          solana: {
            createOnLogin: "all-users",
          },
        },
        externalWallets: {
          solana: {
            connectors: solanaConnectors,
          },
        },
        appearance: {
          theme: "dark",
          walletChainType: "solana-only",
        },
        loginMethods: ["google"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
