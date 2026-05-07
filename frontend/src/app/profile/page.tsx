"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { SiteNav } from "@/components/site-nav";
import { ensurePusdTokenAccount } from "@/lib/pusd";

type BalanceData = {
  wallet: string;
  network: string;
  sol: number;
  pusd: number;
  pusdTokenAccountExists: boolean;
  pusdAta: string;
};

function shortenAddress(address: string) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatTokenAmount(amount: number, decimals: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: amount === 0 ? 2 : 0,
    maximumFractionDigits: decimals,
  });
}

export default function ProfilePage() {
  const { ready, authenticated, login, connectWallet, user } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [creatingPusdAccount, setCreatingPusdAccount] = useState(false);

  const wallet = wallets[0];
  const walletAddress = wallet?.address ?? null;
  const email =
    user?.linkedAccounts.find((account) => account.type === "google_oauth" && "email" in account)?.email ??
    user?.linkedAccounts.find((account) => account.type === "email" && "address" in account)?.address ??
    "Interval user";

  const loadBalances = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBalances(true);
    setBalanceError(null);
    try {
      const res = await fetch(`/api/user/balances?wallet=${encodeURIComponent(walletAddress)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load balances");
      setBalances(data);
    } catch (err) {
      setBalanceError(err instanceof Error ? err.message : "Failed to load balances");
    } finally {
      setLoadingBalances(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  async function copyWallet() {
    if (!walletAddress) return;
    await navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  async function handleCreatePusdAccount() {
    if (!wallet || !walletAddress) return;
    setCreatingPusdAccount(true);
    setBalanceError(null);

    try {
      const result = await ensurePusdTokenAccount({
        wallet,
        walletAddress,
        signAndSendTransaction,
      });

      if (result.created) {
        toast.success("PUSD token account created.");
      } else {
        toast.success("PUSD token account already exists.");
      }

      await loadBalances();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to create your PUSD token account.";
      setBalanceError(message);
      toast.error(message);
    } finally {
      setCreatingPusdAccount(false);
    }
  }

  return (
    <div className="min-h-screen text-white">
      <SiteNav />
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd28e]/80">
            User profile
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Wallet
          </h1>
        </div>

        {!ready ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
            <div className="h-8 w-48 animate-pulse rounded-lg bg-white/10" />
            <div className="mt-6 h-48 animate-pulse rounded-3xl bg-white/10" />
          </section>
        ) : !authenticated ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Sign in to view your profile</h2>
            <p className="mt-2 max-w-xl text-sm text-white/60">
              Creator pages stay public. Your profile and balances appear after you sign in.
            </p>
            <button
              type="button"
              onClick={login}
              className="mt-5 min-h-10 rounded-xl px-5 py-2.5 font-semibold text-black hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
              style={{ backgroundColor: "#ffd28e" }}
            >
              Sign in
            </button>
          </section>
        ) : !walletAddress ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8">
            <h2 className="text-xl font-semibold text-white">Connect your Solana wallet</h2>
            <p className="mt-2 max-w-xl text-sm text-white/60">
              Connect a wallet to see balances and book creator slots.
            </p>
            <button
              type="button"
              onClick={connectWallet}
              className="mt-5 min-h-10 rounded-xl px-5 py-2.5 font-semibold text-black hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
              style={{ backgroundColor: "#ffd28e" }}
            >
              Connect wallet
            </button>
          </section>
        ) : (
          <>
            <section className="overflow-hidden rounded-[2rem] border border-[#cfb439]/35 bg-[#ffe247] text-black shadow-2xl">
              <div className="flex min-h-[260px] flex-col justify-between gap-8 p-6 sm:p-8 lg:p-10">
                <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.32em] text-black/45">
                      Total balance
                    </p>
                    <p className="mt-6 text-5xl font-black tracking-tight sm:text-7xl lg:text-8xl">
                      {loadingBalances && !balances
                        ? "..."
                        : `${formatTokenAmount(balances?.pusd ?? 0, 2)} PUSD`}
                    </p>
                    <div className="mt-6 flex flex-wrap items-center gap-3 text-lg font-bold text-black/60">
                      <span className="inline-flex h-5 w-5 rounded-full bg-gradient-to-br from-emerald-400 via-cyan-400 to-blue-500" />
                      <span>PUSD · Solana {balances?.network === "devnet" ? "Devnet" : "Mainnet"}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3 lg:pt-40">
                    <button
                      type="button"
                      onClick={loadBalances}
                      disabled={loadingBalances}
                      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-black/15 bg-black/5 px-4 text-black/65 transition hover:bg-black/10 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                      aria-label="Refresh balances"
                    >
                      <RefreshIcon spinning={loadingBalances} />
                    </button>
                    <button
                      type="button"
                      onClick={copyWallet}
                      className="inline-flex min-h-12 items-center gap-2 rounded-full border border-black/15 bg-black/5 px-5 font-bold text-black/60 transition hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
                    >
                      <span className="font-mono text-sm">{shortenAddress(walletAddress)}</span>
                      <CopyIcon />
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-sm text-white/45">SOL balance</p>
                <p className="mt-3 text-3xl font-bold text-white">
                  {loadingBalances && !balances ? "..." : formatTokenAmount(balances?.sol ?? 0, 6)} SOL
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5">
                <p className="text-sm text-white/45">PUSD balance</p>
                <p className="mt-3 text-3xl font-bold text-white">
                  {loadingBalances && !balances ? "..." : formatTokenAmount(balances?.pusd ?? 0, 2)} PUSD
                </p>
                {balances && !balances.pusdTokenAccountExists && (
                  <div className="mt-3 space-y-3">
                    <p className="text-xs text-white/40">
                      No PUSD token account yet. Create it once with a small SOL network rent payment.
                    </p>
                    <button
                      type="button"
                      onClick={handleCreatePusdAccount}
                      disabled={creatingPusdAccount}
                      className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
                      style={{ backgroundColor: "#ffd28e" }}
                    >
                      {creatingPusdAccount ? "Creating..." : "Create PUSD account"}
                    </button>
                  </div>
                )}
              </div>
            </section>

            {balanceError && (
              <div className="rounded-2xl border border-red-400/30 bg-red-500/15 px-4 py-3 text-sm text-red-100">
                {balanceError}
              </div>
            )}

            <section className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-white">{email}</p>
                <p className="mt-1 break-all font-mono text-sm text-white/50">{walletAddress}</p>
              </div>
              <Link
                href="/explore"
                className="inline-flex min-h-10 items-center justify-center rounded-xl px-4 py-2 font-semibold text-black hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
                style={{ backgroundColor: "#ffd28e" }}
              >
                Browse creators
              </Link>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      className={`h-5 w-5 ${spinning ? "animate-spin" : ""}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 0 1-14.8 6.9" />
      <path d="M3 12A9 9 0 0 1 17.8 5.1" />
      <path d="M18 2v4h-4" />
      <path d="M6 22v-4h4" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
