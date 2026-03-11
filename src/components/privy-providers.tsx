"use client";

import { PrivyProvider } from "@privy-io/react-auth";
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

export function PrivyProviders({ children }: { children: ReactNode }) {
  if (!appId) {
    return <>{children}</>;
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
