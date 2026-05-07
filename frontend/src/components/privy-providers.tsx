"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";
import { ReactNode } from "react";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? undefined;
const solanaRpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
const solanaWsUrl =
  process.env.NEXT_PUBLIC_SOLANA_WS ??
  solanaRpcUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

const solanaConnectors = toSolanaWalletConnectors();
const solanaRpcs = {
  "solana:devnet": {
    rpc: createSolanaRpc(solanaRpcUrl),
    rpcSubscriptions: createSolanaRpcSubscriptions(solanaWsUrl),
    blockExplorerUrl: "https://explorer.solana.com?cluster=devnet",
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
