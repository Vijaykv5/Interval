"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useExportWallet, useWallets } from "@privy-io/react-auth/solana";
import { toast } from "sonner";
import { AuthRoleModal } from "@/components/auth-role-modal";
import { CreatorAccessCodeModal } from "@/components/creator-access-code-modal";
import { useUserWallet } from "@/components/user-wallet-provider";
import { clearAuthIntent, setAuthIntent, type AuthIntentRole } from "@/lib/auth-intent";

function shortenAddress(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function getGmailDisplayName(
  user: { linkedAccounts?: Array<{ type: string; address?: string | null; email?: string | null }> } | null
): string {
  if (!user?.linkedAccounts?.length) return "Account";
  const google = user.linkedAccounts.find((account) => account.type === "google_oauth");
  if (google && google.email) return google.email;
  const emailAccount = user.linkedAccounts.find((account) => account.type === "email");
  if (emailAccount && emailAccount.address) return emailAccount.address;
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
  unauthenticatedLabel?: string;
};

function getCreatorFromResponse(data: unknown): { profileImageUrl: string | null } | null {
  if (data && typeof data === "object" && "creator" in data) {
    return (data as { creator: { profileImageUrl: string | null } | null }).creator;
  }
  return data as { profileImageUrl: string | null } | null;
}

export function WalletAuth({
  variant = "header",
  unauthenticatedLabel,
}: WalletAuthProps) {
  const { ready, authenticated, login, logout, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const { exportWallet } = useExportWallet();
  const {
    ready: userWalletReady,
    connected: userWalletConnected,
    walletAddress: userWalletAddress,
    openConnectModal,
    disconnect: disconnectUserWallet,
  } = useUserWallet();

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"address" | "recovery" | null>(null);
  const [creatorProfileImageUrl, setCreatorProfileImageUrl] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [creatorAccessOpen, setCreatorAccessOpen] = useState(false);
  const [creatorAccessCode, setCreatorAccessCode] = useState("");
  const [creatorAccessLoading, setCreatorAccessLoading] = useState(false);
  const [creatorAccessError, setCreatorAccessError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const creatorWallet = wallets[0];
  const creatorWalletAddress = creatorWallet?.address ?? null;
  const isSidebar = variant === "sidebar";
  const isLanding = variant === "landing";
  const wrapperClass = isSidebar ? "p-3" : isLanding ? "" : "absolute top-4 right-4";

  useEffect(() => {
    if (!dropdownOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);

  useEffect(() => {
    if (variant !== "sidebar" || !creatorWalletAddress) {
      setCreatorProfileImageUrl(null);
      return;
    }

    let cancelled = false;

    fetch(`/api/creator?wallet=${encodeURIComponent(creatorWalletAddress)}&allowMissing=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled) {
          const creator = getCreatorFromResponse(data);
          setCreatorProfileImageUrl(creator?.profileImageUrl ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCreatorProfileImageUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [creatorWalletAddress, variant]);

  const copyAddress = useCallback((address: string | null) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied("address");
    setTimeout(() => setCopied(null), 2000);
  }, []);

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
      if (!data.private_key) {
        setRecoveryError("No key returned.");
      }
    } catch {
      setRecoveryError("Network error. Try again.");
    } finally {
      setRecoveryLoading(false);
    }
  }, [exportWallet, getAccessToken]);

  const closeRecovery = useCallback(() => {
    setRecoveryOpen(false);
    setRecoveryKey(null);
    setRecoveryError(null);
  }, []);

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
      login();
    } catch {
      setCreatorAccessError("Network error. Please try again.");
    } finally {
      setCreatorAccessLoading(false);
    }
  }

  function handleRoleSelect(role: AuthIntentRole) {
    if (role === "creator") {
      setAuthIntent("creator");
      setRoleModalOpen(false);
      setCreatorAccessError(null);
      setCreatorAccessOpen(true);
      return;
    }

    setAuthIntent("user");
    setRoleModalOpen(false);
    try {
      openConnectModal();
    } catch (connectError) {
      toast.error(
        connectError instanceof Error
          ? connectError.message
          : "Wallet connection failed."
      );
    }
  }

  function renderCreatorSidebar() {
    return (
      <>
        <div className={`${wrapperClass} flex flex-col gap-3`}>
          <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 text-lg font-semibold text-white"
                style={{
                  backgroundColor: creatorProfileImageUrl
                    ? "transparent"
                    : "rgba(255,210,142,0.2)",
                }}
              >
                {creatorProfileImageUrl ? (
                  <img
                    src={creatorProfileImageUrl}
                    alt="Profile"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  getInitial(creatorWalletAddress)
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-white/50">Wallet</p>
                <div className="flex items-center gap-2">
                  <span className="truncate font-mono text-sm text-white">
                    {creatorWalletAddress ? shortenAddress(creatorWalletAddress) : "—"}
                  </span>
                  {creatorWalletAddress ? (
                    <button
                      type="button"
                      onClick={() => copyAddress(creatorWalletAddress)}
                      className="shrink-0 rounded p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
                      title="Copy address"
                    >
                      {copied === "address" ? (
                        <span className="text-xs text-[#ffd28e]">Copied</span>
                      ) : (
                        <CopyIcon />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={fetchRecovery}
              disabled={recoveryLoading}
              className="w-full rounded-lg border border-white/20 bg-white/5 py-2 text-sm font-medium text-white/90 transition-colors hover:border-white/30 hover:bg-white/10 disabled:opacity-50"
            >
              {recoveryLoading ? "Loading…" : "export key"}
            </button>
            <button
              type="button"
              onClick={logout}
              className="text-left text-sm text-white/60 underline hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>

        {recoveryOpen ? (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
              aria-hidden
              onClick={closeRecovery}
            />
            <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0d0d0f] p-5 shadow-2xl">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Recovery / private key</h3>
                <button
                  type="button"
                  onClick={closeRecovery}
                  className="rounded-lg p-2 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Close"
                >
                  <XIcon />
                </button>
              </div>
              {recoveryError ? (
                <p className="mb-3 text-sm text-red-400">{recoveryError}</p>
              ) : null}
              {recoveryLoading && !recoveryKey ? (
                <p className="text-sm text-white/60">Loading…</p>
              ) : null}
              {recoveryKey ? (
                <>
                  <p className="mb-2 text-xs text-white/50">
                    Store this securely. Anyone with this key can control your wallet.
                  </p>
                  <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 p-3">
                    <code className="flex-1 break-all font-mono text-sm text-white/90">
                      {recoveryKey}
                    </code>
                    <button
                      type="button"
                      onClick={copyRecovery}
                      className="shrink-0 rounded p-2 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
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
              ) : null}
            </div>
          </>
        ) : null}
      </>
    );
  }

  function renderDropdown({
    label,
    address,
    logoutLabel,
    onLogout,
  }: {
    label: string;
    address?: string | null;
    logoutLabel: string;
    onLogout: () => void;
  }) {
    return (
      <div className={`${wrapperClass} relative`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setDropdownOpen((open) => !open)}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black ${
            isLanding || isSidebar
              ? "border border-white/12 bg-[#171717]/95 text-white hover:border-[#ffd28e]/22 hover:bg-[#1d1d1d]"
              : "border border-gray-600 bg-gray-800 text-gray-100 hover:bg-gray-700"
          }`}
        >
          <span className="max-w-[160px] truncate text-white/92">{label}</span>
          <ChevronDownIcon open={dropdownOpen} />
        </button>
        {dropdownOpen ? (
          <div
            className={`absolute right-0 top-full z-50 mt-1 min-w-[200px] rounded-xl border py-1 shadow-xl ${
              isLanding || isSidebar
                ? "border-white/10 bg-[#1a1a1a]"
                : "border-gray-600 bg-gray-800"
            }`}
          >
            {address ? (
              <button
                type="button"
                onClick={() => {
                  copyAddress(address);
                  setDropdownOpen(false);
                }}
                className={`flex w-full items-center justify-between px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                  isLanding || isSidebar
                    ? "text-white/80 hover:bg-white/10 hover:text-white"
                    : "text-gray-200 hover:bg-gray-700"
                }`}
              >
                <span>{shortenAddress(address)}</span>
                <span className="text-xs text-white/45">Copy</span>
              </button>
            ) : null}
            <Link
              href="/profile"
              onClick={() => setDropdownOpen(false)}
              className={`block px-4 py-2.5 text-sm font-medium transition-colors ${
                isLanding || isSidebar
                  ? "text-white/80 hover:bg-white/10 hover:text-white"
                  : "text-gray-200 hover:bg-gray-700"
              }`}
            >
              Profile
            </Link>
            <button
              type="button"
              onClick={() => {
                setDropdownOpen(false);
                onLogout();
              }}
              className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                isLanding || isSidebar
                  ? "text-white/80 hover:bg-white/10 hover:text-white"
                  : "text-gray-200 hover:bg-gray-700"
              }`}
            >
              {logoutLabel}
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  if (!ready || !userWalletReady) {
    return (
      <div
        className={`${wrapperClass} px-3 py-1.5 text-sm ${
          isLanding || isSidebar ? "text-white/60" : "text-gray-500"
        }`}
      >
        Loading…
      </div>
    );
  }

  if (authenticated && isSidebar) {
    return renderCreatorSidebar();
  }

  if (authenticated) {
    return renderDropdown({
      label: getGmailDisplayName(user),
      address: creatorWalletAddress,
      logoutLabel: "Log out",
      onLogout: () => {
        logout();
      },
    });
  }

  if (userWalletConnected) {
    return renderDropdown({
      label: shortenAddress(userWalletAddress ?? ""),
      address: userWalletAddress,
      logoutLabel: "Disconnect wallet",
      onLogout: () => {
        void disconnectUserWallet();
      },
    });
  }

  function handleUnauthenticatedClick() {
    if (isSidebar) {
      clearAuthIntent();
      login();
      return;
    }

    setRoleModalOpen(true);
  }

  return (
    <>
      <div className={wrapperClass}>
        <button
          type="button"
          onClick={handleUnauthenticatedClick}
          className={
            isLanding
              ? "min-h-10 rounded-lg px-5 py-2.5 font-semibold transition-colors hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black"
              : isSidebar
                ? "w-full min-h-10 rounded-lg px-4 py-2 font-medium hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30"
                : "w-full min-h-10 rounded-lg border border-gray-300 bg-gray-100 px-4 py-2 font-medium text-gray-800 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          }
          style={
            isLanding || isSidebar
              ? { backgroundColor: "#ffd28e", color: "#000" }
              : undefined
          }
        >
          {unauthenticatedLabel ?? "Connect Wallet"}
        </button>
      </div>

      <AuthRoleModal
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        onSelectRole={handleRoleSelect}
      />

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
    </>
  );
}

function CopyIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
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
