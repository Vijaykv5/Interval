"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { ProfilePhotoUpload } from "@/components/profile-photo-upload";

type Creator = {
  id: string;
  username: string;
  wallet: string;
  profileImageUrl: string | null;
  bio: string | null;
  xAccount: string | null;
};

export default function ProfilePage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [username, setUsername] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creator, setCreator] = useState<Creator | null>(null);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? null;

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
          `/api/creator?wallet=${encodeURIComponent(walletAddress)}`
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setCreator(data);
          setUsername(data.username ?? "");
          setProfileImageUrl(data.profileImageUrl ?? "");
          setXAccount(data.xAccount ?? "");
          setBio(data.bio ?? "");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress) return;
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
          alert("Profile updated.");
        } else {
          alert(data?.error ?? "Failed to update profile");
        }
      } else {
        const res = await fetch("/api/creator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (res.ok) {
          router.replace("/dashboard");
        } else {
          alert(data?.error ?? "Failed to create profile");
        }
      }
    } finally {
      setSubmitting(false);
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

            <div className="flex gap-3 pt-2">
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
