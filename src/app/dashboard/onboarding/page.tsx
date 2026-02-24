"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

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
        <div className="h-48 w-full max-w-md rounded-2xl bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="p-6 md:p-8 max-w-md mx-auto">
        <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Connect your wallet</h1>
          <p className="text-gray-500 text-sm mb-6">
            Connect your wallet in the sidebar to set up or edit your profile.
          </p>
          <Link href="/dashboard" className="text-sm font-medium text-gray-700 hover:text-gray-900 underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 flex items-start justify-center min-h-full">
      {/* Modal-style card */}
      <div className="w-full max-w-lg">
        <div className="rounded-2xl border border-gray-200 bg-white shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100/80 px-6 py-6 border-b border-gray-100">
            {isFirstTime ? (
              <>
                <h1 className="text-xl font-bold text-gray-900">Welcome to Interval</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Set up your profile so others can find and book time with you.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-xl font-bold text-gray-900">Edit profile</h1>
                <p className="text-sm text-gray-500 mt-1">
                  Update your username, photo, X handle, and bio.
                </p>
              </>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Profile image preview + URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Profile photo</label>
              <div className="flex items-start gap-4">
                <div className="shrink-0 w-16 h-16 rounded-full bg-gray-200 overflow-hidden border-2 border-gray-200">
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-gray-400">
                      {username.slice(0, 1).toUpperCase() || "?"}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <input
                    type="url"
                    value={profileImageUrl}
                    onChange={(e) => setProfileImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 mt-1">Direct image URL (Imgur, etc.)</p>
                </div>
              </div>
            </div>

            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                Username <span className="text-red-500">*</span>
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
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="xAccount" className="block text-sm font-medium text-gray-700 mb-1.5">
                X (Twitter) handle
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
                <input
                  id="xAccount"
                  type="text"
                  value={xAccount}
                  onChange={(e) => setXAccount(e.target.value.replace(/^@/, ""))}
                  placeholder="username"
                  maxLength={100}
                  className="w-full rounded-lg border border-gray-300 pl-8 pr-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-1.5">
                Bio <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="A short intro for people who want to book time with you..."
                maxLength={300}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none"
              />
              <p className="text-xs text-gray-500 mt-1">{bio.length}/300</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
              >
                {submitting ? "Saving…" : isFirstTime ? "Continue to dashboard" : "Save changes"}
              </button>
              {!isFirstTime && (
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 rounded-lg font-medium text-gray-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-400"
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
