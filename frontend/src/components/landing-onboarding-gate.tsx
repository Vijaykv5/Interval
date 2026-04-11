"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { OnboardingModal } from "@/components/onboarding-modal";

/**
 * On landing: when user is authenticated, check if they have a creator profile.
 * - If no profile (new user): show onboarding modal immediately. After save, redirect to dashboard.
 * - If profile exists: redirect to dashboard.
 */
export function LandingOnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [showModal, setShowModal] = useState(false);
  const [checked, setChecked] = useState(false);

  const walletAddress = wallets[0]?.address ?? null;

  useEffect(() => {
    if (!ready || !authenticated || !walletAddress) {
      if (ready && authenticated && !walletAddress) setChecked(true);
      return;
    }
    let cancelled = false;
    async function checkCreator() {
      try {
        const res = await fetch(`/api/creator?wallet=${encodeURIComponent(walletAddress)}`);
        if (cancelled) return;
        if (res.ok) {
          router.replace("/dashboard");
          return;
        }
        if (res.status === 404) {
          setShowModal(true);
        }
      } catch {
        if (!cancelled) setShowModal(true);
      } finally {
        if (!cancelled) setChecked(true);
      }
    }
    checkCreator();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, walletAddress, router]);

  function handleSuccess() {
    setShowModal(false);
    router.replace("/dashboard");
  }

  return (
    <>
      {children}
      {showModal && walletAddress && (
        <OnboardingModal
          open={showModal}
          walletAddress={walletAddress}
          onSuccess={handleSuccess}
          onClose={() => {}}
          closable={false}
        />
      )}
    </>
  );
}
