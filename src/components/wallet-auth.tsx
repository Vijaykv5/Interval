"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet, useWallets } from "@privy-io/react-auth/solana";

function shortenAddress(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

/** First character + "..." + last 4 (e.g. "A...xy34") */
function truncateAddressFirstLetter(address: string) {
  if (!address || address.length < 6) return address;
  return `${address[0]}...${address.slice(-4)}`;
}

function getConnectedWithLabel(user: { linkedAccounts?: Array<{ type: string; address?: string }> } | null): string | null {
  if (!user?.linkedAccounts?.length) return null;
  const google = user.linkedAccounts.find((a) => a.type === "google_oauth");
  if (google) return "Gmail";
  const email = user.linkedAccounts.find((a) => a.type === "email");
  if (email && "address" in email && typeof (email as { address?: string }).address === "string") {
    return (email as { address: string }).address;
  }
  return null;
}

/** Gmail/email display name for the header button (email or "Gmail") */
function getGmailDisplayName(user: { linkedAccounts?: Array<{ type: string; address?: string | null; email?: string | null }> } | null): string {
  if (!user?.linkedAccounts?.length) return "Account";
  const google = user.linkedAccounts.find((a) => a.type === "google_oauth");
  if (google && google.email) return google.email;
  const emailAcc = user.linkedAccounts.find((a) => a.type === "email");
  if (emailAcc && emailAcc.address) return emailAcc.address;
  const g = user.linkedAccounts.find((a) => a.type === "google_oauth");
  if (g) return "Gmail";
  return "Account";
}

function getInitial(address: string | null): string {
  if (!address) return "?";
  const hex = address.slice(2, 4);
  const n = parseInt(hex, 16) % 26;
  return String.fromCharCode(65 + n);
}

type WalletAuthProps = {
  variant?: "header" | "sidebar" | "landing";
  /** When set, used as the button label when not authenticated (e.g. "SIGN IN") */
  unauthenticatedLabel?: string;
};

export function WalletAuth({ variant = "header", unauthenticatedLabel }: WalletAuthProps) {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"address" | "recovery" | null>(null);
  const [creatorProfileImageUrl, setCreatorProfileImageUrl] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const solanaWallet = wallets[0];
  const address = solanaWallet?.address ?? null;

  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (variant !== "sidebar" || !address) {
      setCreatorProfileImageUrl(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/creator?wallet=${encodeURIComponent(address)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.profileImageUrl) setCreatorProfileImageUrl(data.profileImageUrl);
        if (!cancelled && !data?.profileImageUrl) setCreatorProfileImageUrl(null);
      })
      .catch(() => {
        if (!cancelled) setCreatorProfileImageUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [variant, address]);

  const isSidebar = variant === "sidebar";
  const isLanding = variant === "landing";
  const wrapperClass = isSidebar
    ? "p-3"
    : isLanding
      ? ""
      : "absolute top-4 right-4";

  const copyAddress = useCallback(() => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied("address");
    setTimeout(() => setCopied(null), 2000);
  }, [address]);

  const copyRecovery = useCallback(() => {
    if (!recoveryKey) return;
    navigator.clipboard.writeText(recoveryKey);
    setCopied("recovery");
    setTimeout(() => setCopied(null), 2000);
  }, [recoveryKey]);

  const fetchRecovery = useCallback(async () => {
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryKey(null);
    setRecoveryOpen(true);
    try {
      const token = await getAccessToken();
      if (!token) {
        setRecoveryError("Please sign in again.");
        return;
      }
      const res = await fetch("/api/wallet/export-recovery", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 400 && data?.code === "use_client_export") {
          setRecoveryOpen(false);
          setRecoveryLoading(false);
          exportWallet();
          return;
        }
        setRecoveryError(data?.error ?? "Could not load recovery key.");
        return;
      }
      setRecoveryKey(data.private_key ?? null);
      if (!data.private_key) setRecoveryError("No key returned.");
    } catch {
      setRecoveryError("Network error. Try again.");
    } finally {
      setRecoveryLoading(false);
    }
  }, [getAccessToken, exportWallet]);

  const closeRecovery = useCallback(() => {
    setRecoveryOpen(false);
    setRecoveryKey(null);
    setRecoveryError(null);
  }, []);

  if (!ready) {
    return (
      <div className={`${wrapperClass} px-3 py-1.5 text-sm ${isLanding || isSidebar ? "text-white/60" : "text-gray-500"}`}>
        Loading…
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className={wrapperClass}>
        <button
          type="button"
          onClick={login}
          className={
            isLanding
              ? "px-5 py-2.5 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black hover:opacity-90"
              : isSidebar
                ? "w-full px-4 py-2 rounded-lg font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30"
                : "w-full px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          }
          style={isLanding || isSidebar ? { backgroundColor: "#ffd28e", color: "#000" } : undefined}
        >
          {unauthenticatedLabel ?? "Connect Wallet"}
        </button>
      </div>
    );
  }

  if (isSidebar) {
    return (
      <>
        <div className={`${wrapperClass} flex flex-col gap-3`}>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 text-lg font-semibold text-white"
                style={{ backgroundColor: creatorProfileImageUrl ? "transparent" : "rgba(255,210,142,0.2)" }}
              >
                {creatorProfileImageUrl ? (
                  <img
                    src={creatorProfileImageUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitial(address)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-white/50 uppercase tracking-wider">Wallet</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-white truncate">
                    {address ? shortenAddress(address) : "—"}
                  </span>
                  {address && (
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="shrink-0 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                      title="Copy address"
                    >
                      {copied === "address" ? (
                        <span className="text-xs text-[#ffd28e]">Copied</span>
                      ) : (
                        <CopyIcon />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchRecovery}
              disabled={recoveryLoading}
              className="w-full rounded-lg border border-white/20 bg-white/5 py-2 text-sm font-medium text-white/90 hover:bg-white/10 hover:border-white/30 transition-colors disabled:opacity-50"
            >
              {recoveryLoading ? "Loading…" : "export key"}
            </button>
            <button
              type="button"
              onClick={logout}
              className="text-sm text-white/60 hover:text-white underline text-left"
            >
              Log out
            </button>
          </div>
        </div>

        {recoveryOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
              onClick={closeRecovery}
            />
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0d0d0f] p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">Recovery / private key</h3>
                <button
                  type="button"
                  onClick={closeRecovery}
                  className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </div>
              {recoveryError && (
                <p className="mb-3 text-sm text-red-400">{recoveryError}</p>
              )}
              {recoveryLoading && !recoveryKey && (
                <p className="text-sm text-white/60">Loading…</p>
              )}
              {recoveryKey && (
                <>
                  <p className="mb-2 text-xs text-white/50">
                    Store this securely. Anyone with this key can control your wallet.
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-3">
                    <code className="flex-1 break-all text-sm text-white/90 font-mono">
                      {recoveryKey}
                    </code>
                    <button
                      type="button"
                      onClick={copyRecovery}
                      className="shrink-0 rounded p-2 text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                      title="Copy"
                    >
                      {copied === "recovery" ? (
                        <span className="text-xs text-[#ffd28e]">Copied</span>
                      ) : (
                        <CopyIcon />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </>
    );
  }

  return (
    <div className={`${wrapperClass} relative`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setDropdownOpen((o) => !o)}
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black ${
          isLanding || isSidebar
            ? "bg-[#1a1a1a] text-white border border-white/10 hover:bg-white/10"
            : "bg-gray-800 text-gray-100 border border-gray-600 hover:bg-gray-700"
        }`}
      >
        <span className="max-w-[160px] truncate">{getGmailDisplayName(user)}</span>
        <ChevronDownIcon open={dropdownOpen} />
      </button>
      {dropdownOpen && (
        <div
          className={`absolute right-0 top-full mt-1 min-w-[140px] rounded-xl border py-1 shadow-xl z-50 ${
            isLanding || isSidebar
              ? "border-white/10 bg-[#1a1a1a]"
              : "border-gray-600 bg-gray-800"
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setDropdownOpen(false);
              logout();
            }}
            className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
              isLanding || isSidebar ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-gray-200 hover:bg-gray-700"
            }`}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
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

function ChevronDownIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
