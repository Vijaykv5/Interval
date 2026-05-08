"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
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

  useEffect(() => {
    if (!ready || !authenticated) return;

    const authIntent = getAuthIntent();

    if (authIntent === "user") {
      clearAuthIntent();
      router.replace("/profile");
      return;
    }

    if (authIntent === "creator") {
      if (!walletAddress) return;

      let cancelled = false;

      async function routeCreator() {
        try {
          await completeCreatorAccess(walletAddress);
          const res = await fetch(`/api/creator?wallet=${encodeURIComponent(walletAddress)}`);
          if (cancelled) return;
          clearAuthIntent();
          router.replace(res.ok ? "/dashboard" : "/dashboard/onboarding");
        } catch {
          if (cancelled) return;
          clearAuthIntent();
          router.replace("/dashboard/onboarding");
        }
      }

      routeCreator();
      return () => {
        cancelled = true;
      };
    }

    router.replace("/profile");
  }, [authenticated, ready, router, walletAddress]);

  return <>{children}</>;
}
