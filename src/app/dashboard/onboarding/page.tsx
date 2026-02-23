"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

export default function OnboardingPage() {
  const router = useRouter();
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [username, setUsername] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [checking, setChecking] = useState(true);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? null;

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !walletAddress) {
      setChecking(false);
      return;
    }
    async function check() {
      try {
        const res = await fetch(
          `/api/creator?wallet=${encodeURIComponent(walletAddress)}`
        );
        if (res.ok) {
          router.replace("/dashboard");
          return;
        }
      } catch {
        // no creator yet, show form
      } finally {
        setChecking(false);
      }
    }
    check();
  }, [ready, authenticated, walletAddress, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          username: username.trim(),
          profileImageUrl: profileImageUrl.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.replace("/dashboard");
      } else {
        alert(data?.error ?? "Failed to create profile");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || checking) {
    return (
      <div className="p-8 md:p-10 max-w-md mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 animate-pulse h-64" />
      </div>
    );
  }

  if (!authenticated || !walletAddress) {
    return (
      <div className="p-8 md:p-10 max-w-md mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Connect your wallet
          </h1>
          <p className="text-gray-500 text-sm mb-6">
            You need to connect your wallet before setting up your profile.
          </p>
          <p className="text-sm text-gray-500">
            Use the sidebar to connect, then return here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-10 max-w-md">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">
        Set up your profile
      </h1>
      <p className="text-gray-500 text-sm mb-8">
        Enter a username and profile picture for the platform. You can change these later.
      </p>

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8 space-y-5"
      >
        <div>
          <label
            htmlFor="username"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Username
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
        </div>
        <div>
          <label
            htmlFor="profileImageUrl"
            className="block text-sm font-medium text-gray-700 mb-1.5"
          >
            Profile picture URL
          </label>
          <input
            id="profileImageUrl"
            type="url"
            value={profileImageUrl}
            onChange={(e) => setProfileImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
          />
          <p className="text-xs text-gray-500 mt-1">
            Optional. Use a direct image link (e.g. from Imgur or your site).
          </p>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:pointer-events-none"
        >
          {submitting ? "Saving…" : "Continue to dashboard"}
        </button>
      </form>
    </div>
  );
}
