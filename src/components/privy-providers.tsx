"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { ReactNode } from "react";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const clientId = process.env.NEXT_PUBLIC_PRIVY_CLIENT_ID ?? undefined;

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
        appearance: {
          walletChainType: "solana-only",
        },
        loginMethods: ["wallet", "email"],
      }}
    >
      {children}
    </PrivyProvider>
  );
}
