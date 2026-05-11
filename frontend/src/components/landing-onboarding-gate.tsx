"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { OnboardingModal } from "@/components/onboarding-modal";
import { clearAuthIntent, getAuthIntent } from "@/lib/auth-intent";
import { completeCreatorAccess } from "@/lib/creator-access-client";

/**
 * On landing: signed-in users go to their profile page.
 * Creator onboarding stays inside the dashboard flow.
 */
export function LandingOnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address ?? null;
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated) return;

    const authIntent = getAuthIntent();

    if (authIntent === "creator") {
      return;
    }

    if (authIntent === "user") {
      clearAuthIntent();
      router.replace("/profile");
      return;
    }

    if (!walletAddress) return;

    let cancelled = false;

    async function routeAuthenticatedLanding() {
      try {
        const accessRes = await fetch(
          `/api/auth/creator-access?wallet=${encodeURIComponent(walletAddress)}`
        );
        const accessData = await accessRes.json().catch(() => ({}));
        if (cancelled) return;

        if (!accessRes.ok) {
          router.replace("/explore");
          return;
        }

        if (accessData?.hasAccess === true) {
          if (accessData?.creatorExists !== true) {
            await completeCreatorAccess(walletAddress);
            if (cancelled) return;
            setOnboardingOpen(true);
            return;
          }

          if (accessData?.onchainReady === true) {
            clearAuthIntent();
            router.replace("/dashboard");
            return;
          }

          setOnboardingOpen(true);
          return;
        }

        router.replace("/explore");
      } catch {
        if (cancelled) return;
        router.replace("/explore");
      }
    }

    routeAuthenticatedLanding();
    return () => {
      cancelled = true;
    };
  }, [authenticated, ready, router, walletAddress]);

  return (
    <>
      {children}
      {walletAddress ? (
        <OnboardingModal
          open={onboardingOpen}
          walletAddress={walletAddress}
          closable={false}
          onClose={() => setOnboardingOpen(false)}
          onSuccess={() => {
            clearAuthIntent();
            setOnboardingOpen(false);
            router.replace("/dashboard");
          }}
        />
      ) : null}
    </>
  );
}
