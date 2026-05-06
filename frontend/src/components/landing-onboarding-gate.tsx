"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";

/**
 * On landing: signed-in users go to their wallet profile.
 * Creator onboarding stays inside the dashboard flow.
 */
export function LandingOnboardingGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();

  useEffect(() => {
    if (ready && authenticated) {
      router.replace("/profile");
    }
  }, [ready, authenticated, router]);

  return <>{children}</>;
}
