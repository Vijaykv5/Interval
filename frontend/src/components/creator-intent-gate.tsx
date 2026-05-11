"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { CreatorAccessCodeModal } from "@/components/creator-access-code-modal";
import { OnboardingModal } from "@/components/onboarding-modal";
import { completeCreatorAccess } from "@/lib/creator-access-client";
import { clearAuthIntent, getAuthIntent, setAuthIntent } from "@/lib/auth-intent";

export function CreatorIntentGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address ?? null;
  const [creatorAccessOpen, setCreatorAccessOpen] = useState(false);
  const [creatorAccessCode, setCreatorAccessCode] = useState("");
  const [creatorAccessLoading, setCreatorAccessLoading] = useState(false);
  const [creatorAccessError, setCreatorAccessError] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  useEffect(() => {
    if (!ready || !authenticated || getAuthIntent() !== "creator") return;
    if (!walletAddress) return;

    let cancelled = false;

    async function continueCreatorFlow() {
      try {
        const accessRes = await fetch(
          `/api/auth/creator-access?wallet=${encodeURIComponent(walletAddress)}`
        );
        const accessData = await accessRes.json().catch(() => ({}));
        if (cancelled) return;

        if (!accessRes.ok) {
          setCreatorAccessError(
            typeof accessData?.error === "string"
              ? accessData.error
              : "Could not verify creator access."
          );
          setCreatorAccessOpen(true);
          return;
        }

        if (accessData?.hasAccess !== true) {
          setCreatorAccessError("Enter your creator access code to continue.");
          setCreatorAccessOpen(true);
          return;
        }

        if (accessData?.creatorExists !== true) {
          try {
            await completeCreatorAccess(walletAddress);
          } catch (error) {
            if (cancelled) return;
            setCreatorAccessError(
              error instanceof Error ? error.message : "Could not complete creator access."
            );
            setCreatorAccessOpen(true);
            return;
          }
          if (cancelled) return;
          setOnboardingOpen(true);
          return;
        }

        if (accessData?.onchainReady !== true) {
          setOnboardingOpen(true);
          return;
        }

        clearAuthIntent();
        if (!pathname.startsWith("/dashboard")) {
          router.replace("/dashboard");
        }
      } catch {
        if (cancelled) return;
        setCreatorAccessError("Network error. Please try again.");
        setCreatorAccessOpen(true);
      }
    }

    continueCreatorFlow();
    return () => {
      cancelled = true;
    };
  }, [authenticated, pathname, ready, router, walletAddress]);

  async function handleCreatorAccessSubmit(code: string) {
    setCreatorAccessLoading(true);
    setCreatorAccessError(null);

    try {
      const res = await fetch("/api/auth/creator-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setCreatorAccessError(
          typeof data?.error === "string"
            ? data.error
            : "Could not verify your creator access code."
        );
        return;
      }

      setCreatorAccessCode("");
      setCreatorAccessOpen(false);
      setAuthIntent("creator");

      if (!authenticated) {
        login();
        return;
      }

      if (walletAddress) {
        await completeCreatorAccess(walletAddress);
        setOnboardingOpen(true);
      }
    } catch {
      setCreatorAccessError("Network error. Please try again.");
    } finally {
      setCreatorAccessLoading(false);
    }
  }

  return (
    <>
      {children}
      <CreatorAccessCodeModal
        open={creatorAccessOpen}
        code={creatorAccessCode}
        loading={creatorAccessLoading}
        error={creatorAccessError}
        onClose={() => {
          if (creatorAccessLoading) return;
          setCreatorAccessOpen(false);
          setCreatorAccessCode("");
          setCreatorAccessError(null);
        }}
        onCodeChange={setCreatorAccessCode}
        onSubmit={handleCreatorAccessSubmit}
      />
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
