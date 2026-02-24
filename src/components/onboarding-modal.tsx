"use client";

import { useState } from "react";
import { ProfilePhotoUpload } from "@/components/profile-photo-upload";

type OnboardingModalProps = {
  open: boolean;
  onClose: () => void;
  walletAddress: string;
  onSuccess: () => void;
  /** When false, user cannot close without saving (no X, backdrop click does nothing) */
  closable?: boolean;
};

export function OnboardingModal({ open, onClose, walletAddress, onSuccess, closable = true }: OnboardingModalProps) {
  const [username, setUsername] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [bio, setBio] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/creator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          username: username.trim(),
          profileImageUrl: profileImageUrl.trim() || undefined,
          xAccount: xAccount.trim() || undefined,
          bio: bio.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        setError(data?.error ?? "Failed to create profile");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
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
            <p className="text-sm text-red-400 bg-red-400/10 rounded-lg px-3 py-2">{error}</p>
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
