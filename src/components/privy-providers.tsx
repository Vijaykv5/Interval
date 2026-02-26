"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { createSolanaRpc } from "@solana/rpc";
import { createSolanaRpcSubscriptions } from "@solana/rpc-subscriptions";
import { devnet } from "@solana/rpc-types";
import { ReactNode } from "react";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? undefined;

const devnetRpcUrl =
  process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";
const devnetWsUrl = devnetRpcUrl.replace(/^https:/, "wss:").replace(/^http:/, "ws:");

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
            "solana:devnet": {
              rpc: createSolanaRpc(devnet(devnetRpcUrl)),
              rpcSubscriptions: createSolanaRpcSubscriptions(
                devnet(devnetWsUrl)
              ),
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
