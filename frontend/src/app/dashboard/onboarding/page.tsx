"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import bs58 from "bs58";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import {
  useWallets,
  useSignAndSendTransaction,
  useSignTransaction,
} from "@privy-io/react-auth/solana";
import { ProfilePhotoUpload } from "@/components/profile-photo-upload";
import {
  canInitializeIntervalPlatform,
  getIntervalPlatformAdminWallet,
  initializeIntervalPlatform,
  IntervalTransactionError,
} from "@/lib/interval-program";
import { ensurePusdTokenAccount } from "@/lib/pusd";
import { getExplorerTransactionUrl, getSelectedSolanaWalletChain } from "@/lib/solana-config";

type Creator = {
  id: string;
  username: string;
  wallet: string;
  profileImageUrl: string | null;
  bio: string | null;
  xAccount: string | null;
};

function signatureToString(signature: string | Uint8Array | undefined) {
  if (!signature) return "";
  return typeof signature === "string" ? signature : bs58.encode(signature);
}

function getCreatorFromResponse(data: unknown): Creator | null {
  if (data && typeof data === "object" && "creator" in data) {
    return (data as { creator: Creator | null }).creator;
  }
  return data as Creator;
}

export default function ProfilePage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction } = useSignTransaction();
  const [username, setUsername] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [initializingPlatform, setInitializingPlatform] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? null;
  const configuredAdminWallet = getIntervalPlatformAdminWallet();
  const walletCanInitializePlatform = canInitializeIntervalPlatform(walletAddress);
  const platformMissingError = setupError?.includes("Interval platform is not initialized on-chain.") ?? false;

  function txDescription(signature: string) {
    const url = getExplorerTransactionUrl(signature);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        View transaction
      </a>
    );
  }

  function notifyTx(kind: "success" | "error", message: string, signature?: string | null) {
    const options = signature
      ? { description: txDescription(signature) }
      : undefined;
    if (kind === "success") {
      toast.success(message, options);
      return;
    }
    toast.error(message, options);
  }

  const isFirstTime = creator === null && !loading;

  useEffect(() => {
    if (!ready || !walletAddress) {
      setLoading(false);
      return;
    }
    if (!authenticated) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchCreator() {
      try {
        const res = await fetch(
          `/api/creator?wallet=${encodeURIComponent(walletAddress)}&allowMissing=true`
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          const creatorData = getCreatorFromResponse(data);
          if (creatorData) {
            setCreator(creatorData);
            setUsername(creatorData.username ?? "");
            setProfileImageUrl(creatorData.profileImageUrl ?? "");
            setXAccount(creatorData.xAccount ?? "");
            setBio(creatorData.bio ?? "");
          } else {
            setCreator(null);
          }
        }
      } catch {
        if (!cancelled) setCreator(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchCreator();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, walletAddress]);

  async function completeOnchainSetup() {
    if (solanaWallet?.address !== walletAddress || !walletAddress) return;

    const sponsoredRes = await fetch("/api/creator/onchain-onboard", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wallet: walletAddress }),
    });
    const sponsoredData = await sponsoredRes.json().catch(() => ({}));

    if (!sponsoredRes.ok) {
      throw new Error(
        sponsoredData?.error ?? "Failed to complete creator onboarding on-chain."
      );
    }

    if (!sponsoredData?.transaction || typeof sponsoredData.transaction !== "string") {
      if (sponsoredData?.alreadyOnchain) {
        const pusdResult = await ensurePusdTokenAccount({
          wallet: solanaWallet,
          walletAddress,
          signAndSendTransaction,
        });
        if (pusdResult.created) {
          notifyTx("success", "PUSD token account created.", pusdResult.signature);
        }
        return;
      }

      throw new Error("Sponsored onboarding did not return a transaction to sign.");
    }

    const result = await signTransaction({
      transaction: Uint8Array.from(Buffer.from(sponsoredData.transaction, "base64")),
      wallet: solanaWallet,
      chain: getSelectedSolanaWalletChain(),
    });
    const finalizeRes = await fetch("/api/creator/onchain-onboard", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        wallet: walletAddress,
        transaction: Buffer.from(result.signedTransaction).toString("base64"),
        lastValidBlockHeight: sponsoredData.lastValidBlockHeight,
      }),
    });
    const finalizeData = await finalizeRes.json().catch(() => ({}));
    if (!finalizeRes.ok) {
      throw new Error(
        finalizeData?.error ?? "Sponsored onboarding transaction failed to finalize."
      );
    }
    const signature =
      typeof finalizeData?.signature === "string" ? finalizeData.signature : null;
    if (!signature) {
      throw new Error("Sponsored onboarding was finalized, but no signature was returned.");
    }

    const creatorProfileResult = {
      created: true,
      signature,
    };

    if (creatorProfileResult.created) {
      notifyTx("success", "Creator profile registered on-chain.", creatorProfileResult.signature);
    }

    const pusdResult = await ensurePusdTokenAccount({
      wallet: solanaWallet,
      walletAddress,
      signAndSendTransaction,
    });
    if (pusdResult.created) {
      notifyTx("success", "PUSD token account created.", pusdResult.signature);
    }
  }

  function getCreatorPayload() {
    return {
      wallet: walletAddress,
      username: username.trim(),
      profileImageUrl: profileImageUrl.trim() || undefined,
      xAccount: xAccount.trim() || undefined,
      bio: bio.trim() || undefined,
    };
  }

  async function validateCreatorPayload() {
    const res = await fetch("/api/creator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...getCreatorPayload(),
        validateOnly: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? "Failed to validate creator profile");
    }
  }

  async function saveCreatorProfile() {
    const res = await fetch("/api/creator", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getCreatorPayload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? "Failed to create profile");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress) return;
    setSetupError(null);
    setSubmitting(true);
    try {
      const payload = {
        wallet: walletAddress,
        username: username.trim(),
        profileImageUrl: profileImageUrl.trim() || undefined,
        xAccount: xAccount.trim() || undefined,
        bio: bio.trim() || undefined,
      };

      if (creator) {
        const res = await fetch("/api/creator", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          setCreator(data);
          toast.success("Profile updated.");
        } else {
          toast.error(data?.error ?? "Failed to update profile");
        }
      } else {
        await validateCreatorPayload();
        if (solanaWallet?.address === walletAddress) {
          try {
            await completeOnchainSetup();
          } catch (setupError) {
            const message =
              setupError instanceof Error
                ? setupError.message
                : "Failed to create your creator profile on-chain.";
            setSetupError(message);
            notifyTx(
              "error",
              message,
              setupError instanceof IntervalTransactionError ? setupError.signature : undefined
            );
            return;
          }
        }
        await saveCreatorProfile();
        router.replace("/dashboard");
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleInitializePlatform() {
    if (!solanaWallet || solanaWallet.address !== walletAddress || !walletAddress) return;

    setInitializingPlatform(true);
    setSetupError(null);
    try {
      const result = await initializeIntervalPlatform({
        wallet: solanaWallet,
        walletAddress,
        signAndSendTransaction,
      });
      if (result.created) {
        notifyTx("success", "Interval platform initialized.", result.signature);
      }
      await completeOnchainSetup();
      await saveCreatorProfile();
      router.replace("/dashboard");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to initialize the Interval platform.";
      setSetupError(message);
      notifyTx(
        "error",
        message,
        error instanceof IntervalTransactionError ? error.signature : undefined
      );
    } finally {
      setInitializingPlatform(false);
    }
  }

  if (!ready || loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <div className="h-48 w-full max-w-md rounded-2xl bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="p-6 md:p-8 max-w-md mx-auto text-white">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">Connect your wallet</h1>
          <p className="text-white/60 text-sm mb-6">
            Connect your wallet in the sidebar to set up or edit your profile.
          </p>
          <Link href="/dashboard" className="text-sm font-medium hover:text-white underline" style={{ color: "#ffd28e" }}>
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 flex items-start justify-center min-h-full text-white">
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
          <div className="px-6 py-6 border-b border-white/10">
            {isFirstTime ? (
              <>
                <h1 className="text-xl font-bold text-white">Welcome to Interval</h1>
                <p className="text-sm text-white/60 mt-1">
                  Set up your profile so others can find and book time with you.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-white">Edit profile</h1>
                <p className="text-sm text-white/60 mt-1">
                  Update your username, photo, X handle, and bio.
                </p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {setupError && (
              <div className="space-y-3 rounded-lg bg-red-400/10 px-3 py-3 text-sm text-red-300">
                <p>{setupError}</p>
                {platformMissingError && (
                  <div className="space-y-3">
                    <p className="text-red-200/80">
                      {walletCanInitializePlatform
                        ? "This wallet can initialize the platform now and finish onboarding."
                        : configuredAdminWallet
                          ? `Ask the configured admin wallet ${configuredAdminWallet.slice(0, 6)}...${configuredAdminWallet.slice(-4)} to initialize the Interval platform first.`
                          : "No admin wallet is configured for platform initialization."}
                    </p>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      {walletCanInitializePlatform && (
                        <button
                          type="button"
                          onClick={handleInitializePlatform}
                          disabled={initializingPlatform}
                          className="inline-flex min-h-10 items-center justify-center rounded-lg px-4 py-2 font-medium text-black hover:opacity-90 disabled:pointer-events-none disabled:opacity-60"
                          style={{ backgroundColor: "#ffd28e" }}
                        >
                          {initializingPlatform ? "Initializing..." : "Initialize platform and continue"}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-white/80 mb-2">Profile photo</label>
              <ProfilePhotoUpload
                value={profileImageUrl}
                onChange={setProfileImageUrl}
                placeholderLetter={username.slice(0, 1).toUpperCase() || "?"}
                size="lg"
              />
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-white/80 mb-1.5">
                Username <span className="text-red-400">*</span>
              </label>
              <input
                id="username"
                type="text"
                required
                minLength={1}
                maxLength={50}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
              />
            </div>

            <div>
              <label htmlFor="xAccount" className="block text-sm font-medium text-white/80 mb-1.5">
                X (Twitter) handle
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
                <input
                  id="xAccount"
                  type="text"
                  value={xAccount}
                  onChange={(e) => setXAccount(e.target.value.replace(/^@/, ""))}
                  placeholder="username"
                  maxLength={100}
                  className="w-full rounded-lg border border-white/20 bg-black/30 pl-8 pr-3 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-white/80 mb-1.5">
                Bio <span className="text-white/50 font-normal">(optional)</span>
              </label>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro for people who want to book time with you..."
                maxLength={300}
                className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
              />
              <p className="text-xs text-white/50 mt-1">{bio.length}/300</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 px-5 py-2.5 rounded-lg font-medium text-black hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#030305] disabled:opacity-60 disabled:pointer-events-none"
                style={{ backgroundColor: "#ffd28e" }}
              >
                {submitting ? "Saving…" : isFirstTime ? "Continue to dashboard" : "Save changes"}
              </button>
              {!isFirstTime && (
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 rounded-lg font-medium border border-white/20 text-white/80 hover:bg-white/5 focus:outline-none focus:ring-2 focus:ring-white/30"
                >
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
