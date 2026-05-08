"use client";

import { createContext, useContext, useMemo, useState } from "react";
import {
  setSelectedSolanaNetwork,
  type SolanaNetwork,
} from "@/lib/solana-config";

type SolanaNetworkContextValue = {
  network: SolanaNetwork;
  setNetwork: (network: SolanaNetwork) => void;
};

const SolanaNetworkContext = createContext<SolanaNetworkContextValue | null>(null);

export function NetworkProvider({
  initialNetwork,
  children,
}: {
  initialNetwork: SolanaNetwork;
  children: React.ReactNode;
}) {
  const [network, setNetworkState] = useState<SolanaNetwork>(initialNetwork);

  const value = useMemo<SolanaNetworkContextValue>(
    () => ({
      network,
      setNetwork: (nextNetwork) => {
        setNetworkState(nextNetwork);
        setSelectedSolanaNetwork(nextNetwork);
      },
    }),
    [network]
  );

  return (
    <SolanaNetworkContext.Provider value={value}>
      {children}
    </SolanaNetworkContext.Provider>
  );
}

export function useSolanaNetwork() {
  const context = useContext(SolanaNetworkContext);

  if (!context) {
    throw new Error("useSolanaNetwork must be used within NetworkProvider.");
  }

  return context;
}
