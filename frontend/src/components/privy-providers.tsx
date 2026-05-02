"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { createSolanaRpc } from "@solana/rpc";
import { createSolanaRpcSubscriptions } from "@solana/rpc-subscriptions";
import { ReactNode } from "react";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? undefined;

const mainnetRpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
  process.env.NEXT_PUBLIC_SOLANA_MAINNET_RPC ??
  "https://api.mainnet-beta.solana.com";
const mainnetWsUrl = mainnetRpcUrl
  .replace(/^https:/, "wss:")
  .replace(/^http:/, "ws:");
const solanaConnectors = toSolanaWalletConnectors();

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
        solana: {
          rpcs: {
            "solana:mainnet-beta": {
              rpc: createSolanaRpc(mainnetRpcUrl as never),
              rpcSubscriptions: createSolanaRpcSubscriptions(mainnetWsUrl as never),
            },
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
