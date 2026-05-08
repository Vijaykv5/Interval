"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { CreatorAccessCodeModal } from "@/components/creator-access-code-modal";
import { OnboardingModal } from "@/components/onboarding-modal";
import { completeCreatorAccess } from "@/lib/creator-access-client";
import { clearAuthIntent, setAuthIntent } from "@/lib/auth-intent";

export function LandingCtas() {
  const router = useRouter();
  const { authenticated, login } = usePrivy();
  const { wallets } = useWallets();
  const walletAddress = wallets[0]?.address ?? null;
  const [creatorAccessOpen, setCreatorAccessOpen] = useState(false);
  const [creatorAccessCode, setCreatorAccessCode] = useState("");
  const [creatorAccessLoading, setCreatorAccessLoading] = useState(false);
  const [creatorAccessError, setCreatorAccessError] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(false);

  async function routeAuthenticatedCreator() {
    if (!walletAddress) {
      setAuthIntent("creator");
      login();
      return;
    }

    const accessRes = await fetch(
      `/api/auth/creator-access?wallet=${encodeURIComponent(walletAddress)}`
    );
    const accessData = await accessRes.json().catch(() => ({}));

    if (!accessRes.ok) {
      throw new Error(
        typeof accessData?.error === "string"
          ? accessData.error
          : "Could not verify creator access."
      );
    }

    if (accessData?.hasAccess !== true) {
      setCreatorAccessError("Enter your creator access code to continue.");
      setCreatorAccessOpen(true);
      return;
    }

    if (accessData?.creatorExists !== true) {
      setAuthIntent("creator");
      await completeCreatorAccess(walletAddress);
      setOnboardingOpen(true);
      return;
    }

    if (accessData?.onchainReady !== true) {
      setAuthIntent("creator");
      setOnboardingOpen(true);
      return;
    }

    clearAuthIntent();
    router.push("/dashboard");
  }

  async function routeCreator() {
    clearAuthIntent();
    setCreatorAccessError(null);

    if (authenticated) {
      try {
        await routeAuthenticatedCreator();
      } catch (error) {
        setCreatorAccessError(
          error instanceof Error ? error.message : "Could not continue as creator."
        );
        setCreatorAccessOpen(true);
      }
      return;
    }

    setCreatorAccessOpen(true);
  }

  function routeUser() {
    clearAuthIntent();
    router.push("/explore");
  }

  async function handleCreatorAccessSubmit(code: string) {
    setCreatorAccessLoading(true);
    setCreatorAccessError(null);

    try {
      const res = await fetch("/api/auth/creator-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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

      if (authenticated && walletAddress) {
        setAuthIntent("creator");
        await completeCreatorAccess(walletAddress);
        setOnboardingOpen(true);
        return;
      }

      setAuthIntent("creator");
      login();
    } catch {
      setCreatorAccessError("Network error. Please try again.");
    } finally {
      setCreatorAccessLoading(false);
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
        <button
          type="button"
          onClick={() => void routeCreator()}
          className="inline-flex min-h-12 items-center justify-center px-7 py-4 rounded-xl font-semibold transition-all hover:opacity-95 hover:scale-[1.02] border-2 border-transparent shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{
            backgroundColor: "#ffd28e",
            color: "#000",
          }}
        >
          <span className="whitespace-nowrap">Are you a creator?</span>
        </button>

        <button
          type="button"
          onClick={routeUser}
          className="inline-flex min-h-12 items-center justify-center px-7 py-4 rounded-xl font-semibold border-2 transition-all hover:scale-[1.02] hover:opacity-90 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          style={{ borderColor: "#ffd28e", color: "#ffd28e", backgroundColor: "rgba(255, 210, 142, 0.12)" }}
        >
          <span className="whitespace-nowrap">Looking for creators?</span>
        </button>
      </div>

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
            router.push("/dashboard");
          }}
        />
      ) : null}
    </>
  );
}
