"use client";

import { useEffect, useState } from "react";
import bs58 from "bs58";
import { toast } from "sonner";
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
import { getExplorerTransactionUrl, SOLANA_WALLET_CHAIN } from "@/lib/solana-config";

type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  onSuccess: () => void;
  /** When false, user cannot close without saving (no X, backdrop click does nothing) */
  closable?: boolean;
};

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

export function OnboardingModal({ open, onClose, walletAddress, onSuccess, closable = true }: OnboardingModalProps) {
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { signTransaction } = useSignTransaction();
  const [username, setUsername] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [bio, setBio] = useState("");
  const [creator, setCreator] = useState<Creator | null>(null);
  const [checkingExistingProfile, setCheckingExistingProfile] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initializingPlatform, setInitializingPlatform] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solanaWallet = wallets[0];
  const configuredAdminWallet = getIntervalPlatformAdminWallet();
  const walletCanInitializePlatform = canInitializeIntervalPlatform(walletAddress);
  const platformMissingError = error?.includes("Interval platform is not initialized on-chain.") ?? false;

  useEffect(() => {
    if (!open || !walletAddress) {
      setCheckingExistingProfile(false);
      return;
    }

    let cancelled = false;

    async function fetchCreator() {
      setCheckingExistingProfile(true);
      try {
        const res = await fetch(`/api/creator?wallet=${encodeURIComponent(walletAddress)}`);
        if (!res.ok) {
          if (!cancelled) {
            setCreator(null);
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;
        setCreator(data);
        setUsername(data.username ?? "");
        setProfileImageUrl(data.profileImageUrl ?? "");
        setXAccount(data.xAccount ?? "");
        setBio(data.bio ?? "");
        onSuccess();
      } catch {
        if (!cancelled) {
          setCreator(null);
        }
      } finally {
        if (!cancelled) {
          setCheckingExistingProfile(false);
        }
      }
    }

    fetchCreator();
    return () => {
      cancelled = true;
    };
  }, [open, walletAddress, onSuccess]);

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

  async function completeOnchainSetup() {
    if (solanaWallet?.address !== walletAddress) return;

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
      chain: SOLANA_WALLET_CHAIN,
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
    if (creator) return;
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
      method: creator ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getCreatorPayload()),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error ?? (creator ? "Failed to update profile" : "Failed to create profile"));
    }
    setCreator(data);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await validateCreatorPayload();
      if (solanaWallet?.address === walletAddress) {
        try {
          await completeOnchainSetup();
        } catch (setupError) {
          const message =
            setupError instanceof Error
              ? setupError.message
              : "Failed to create your creator profile on-chain.";
          setError(message);
          notifyTx(
            "error",
            message,
            setupError instanceof IntervalTransactionError ? setupError.signature : undefined
          );
          return;
        }
      }
      await saveCreatorProfile();
      onSuccess();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open || checkingExistingProfile) {
    return null;
  }

  async function handleInitializePlatform() {
    if (!solanaWallet || solanaWallet.address !== walletAddress) return;

    setInitializingPlatform(true);
    setError(null);
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
      onSuccess();
    } catch (setupError) {
      const message =
        setupError instanceof Error
          ? setupError.message
          : "Failed to initialize the Interval platform.";
      setError(message);
      notifyTx(
        "error",
        message,
        setupError instanceof IntervalTransactionError ? setupError.signature : undefined
      );
    } finally {
      setInitializingPlatform(false);
    }
  }

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={closable ? onClose : undefined}
      />
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0d0d0f] shadow-2xl overflow-hidden mx-4">
        <div className="px-6 py-6 border-b border-white/10 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Welcome to Interval</h1>
            <p className="text-sm text-white/60 mt-1">
              Set up your profile so others can find and book time with you.
            </p>
          </div>
          {closable && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Close"
            >
              <XIcon />
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="space-y-3 rounded-lg bg-red-400/10 px-3 py-3 text-sm text-red-300">
              <p>{error}</p>
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
            <label htmlFor="modal-username" className="block text-sm font-medium text-white/80 mb-1.5">
              Username <span className="text-red-400">*</span>
            </label>
            <input
              id="modal-username"
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
            <label htmlFor="modal-xAccount" className="block text-sm font-medium text-white/80 mb-1.5">
              X (Twitter) handle
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">@</span>
              <input
                id="modal-xAccount"
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
            <label htmlFor="modal-bio" className="block text-sm font-medium text-white/80 mb-1.5">
              Bio <span className="text-white/50 font-normal">(optional)</span>
            </label>
            <textarea
              id="modal-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short intro for people who want to book time with you..."
              maxLength={300}
              className="w-full rounded-lg border border-white/20 bg-black/30 px-3 py-2.5 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 resize-none"
            />
            <p className="text-xs text-white/50 mt-1">{bio.length}/300</p>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full px-5 py-2.5 rounded-lg font-medium text-black hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-[#0d0d0f] disabled:opacity-60 disabled:pointer-events-none"
              style={{ backgroundColor: "#ffd28e" }}
            >
              {submitting ? "Saving…" : "Continue to dashboard"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

function XIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
