"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { useSolanaNetwork } from "@/components/network-provider";
import { ensurePusdTokenAccount } from "@/lib/pusd";
import { hasConfiguredPusdMint } from "@/lib/solana-config";

function getSessionKey(network: string, walletAddress: string) {
  return `interval:pusd-ata:${network}:${walletAddress}`;
}

export function PusdAutoProvisioner() {
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { network } = useSolanaNetwork();
  const inFlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !authenticated) return;
    if (!hasConfiguredPusdMint(network)) return;

    const wallet = wallets[0];
    const walletAddress = wallet?.address ?? null;
    if (!wallet || !walletAddress) return;

    const sessionKey = getSessionKey(network, walletAddress);
    if (typeof window !== "undefined") {
      const status = window.sessionStorage.getItem(sessionKey);
      if (status === "done" || status === "failed") {
        return;
      }
    }

    if (inFlightRef.current === sessionKey) {
      return;
    }

    inFlightRef.current = sessionKey;

    void ensurePusdTokenAccount({
      wallet,
      walletAddress,
      signAndSendTransaction,
      network,
    })
      .then((result) => {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(sessionKey, "done");
        }

        if (result.created) {
          toast.success("PUSD token account created.");
        }
      })
      .catch((error) => {
        console.error("Automatic PUSD token account setup failed:", error);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(sessionKey, "failed");
        }
      })
      .finally(() => {
        if (inFlightRef.current === sessionKey) {
          inFlightRef.current = null;
        }
      });
  }, [authenticated, network, ready, signAndSendTransaction, wallets]);

  return null;
}
