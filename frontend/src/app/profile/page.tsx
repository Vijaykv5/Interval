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

type UserBooking = {
  id: string;
  amount: number;
  currency: "SOL" | "PUSD";
  status: string;
  name: string | null;
  callFor: string | null;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    profileImageUrl: string | null;
  };
  slot: {
    id: string;
    startTime: string;
    endTime: string;
    meetLink: string | null;
    status: string;
  };
};

type BookingSummaryData = {
  bookings: UserBooking[];
  nextBooking: UserBooking | null;
  upcomingCount: number;
  completedCount: number;
  totalSpent: {
    SOL: number;
    PUSD: number;
  };
};

function shortenAddress(address: string) {
  if (!address || address.length < 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatWalletBadge(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)} • ${address.slice(-4)}`;
}

function formatTokenAmount(amount: number, decimals: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: amount === 0 ? 2 : 0,
    maximumFractionDigits: decimals,
  });
}

function formatAmount(amount: number, currency: "SOL" | "PUSD") {
  return `${formatTokenAmount(amount, currency === "SOL" ? 4 : 2)} ${currency}`;
}

function formatDateLabel(value: string) {
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTimeRange(start: string, end: string) {
  return `${new Date(start).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })} - ${new Date(end).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })}`;
}

function bookingPhase(start: string, end: string) {
  const now = Date.now();
  const startTs = new Date(start).getTime();
  const endTs = new Date(end).getTime();

  if (endTs < now) return "Completed";
  if (startTs <= now) return "Live";
  return "Upcoming";
}

export default function ProfilePage() {
  const { ready, authenticated, login, connectWallet, user } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [bookingSummary, setBookingSummary] = useState<BookingSummaryData | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
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

  const loadBookings = useCallback(async () => {
    if (!walletAddress) return;
    setLoadingBookings(true);
    setBookingError(null);
    try {
      const res = await fetch(`/api/user/bookings?wallet=${encodeURIComponent(walletAddress)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to load bookings");
      setBookingSummary(data);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoadingBookings(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    loadBalances();
  }, [loadBalances]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

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

  const bookings = bookingSummary?.bookings ?? [];
  const nextBooking = bookingSummary?.nextBooking ?? null;
  const bookingCount = bookings.length;
  const upcomingCount = bookingSummary?.upcomingCount ?? 0;
  const totalSpentPusd = bookingSummary?.totalSpent.PUSD ?? 0;
  const totalSpentSol = bookingSummary?.totalSpent.SOL ?? 0;

  return (
    <div className="min-h-screen bg-[#06070b] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-90"
        style={{
          background:
            "radial-gradient(circle at 18% 20%, rgba(86, 99, 255, 0.16) 0, transparent 26%), radial-gradient(circle at 82% 16%, rgba(71, 196, 255, 0.12) 0, transparent 24%), radial-gradient(circle at 50% 100%, rgba(255, 163, 87, 0.10) 0, transparent 34%), linear-gradient(180deg, #06070b 0%, #090b12 42%, #0b0f17 100%)",
        }}
      />
      <SiteNav />
      <main className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
              Account overview
            </p>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-white sm:text-5xl">
              Your wallet, bookings, and upcoming sessions
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/58 sm:text-base">
              Keep an eye on balances, recent activity, and the next creator session you have lined up.
            </p>
          </div>
          {walletAddress && (
            <div className="inline-flex items-center gap-3 self-start rounded-full border border-white/10 bg-white/6 px-4 py-2 text-sm text-white/70 backdrop-blur-sm">
              <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="font-mono">{formatWalletBadge(walletAddress)}</span>
            </div>
          )}
        </div>

        {!ready ? (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.5fr_0.9fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                <div className="h-4 w-28 animate-pulse rounded-full bg-white/10" />
                <div className="mt-5 h-14 w-72 animate-pulse rounded-2xl bg-white/10" />
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <div className="h-24 animate-pulse rounded-2xl bg-white/10" />
                  <div className="h-24 animate-pulse rounded-2xl bg-white/10" />
                </div>
              </div>
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm">
                <div className="h-4 w-24 animate-pulse rounded-full bg-white/10" />
                <div className="mt-5 h-24 animate-pulse rounded-2xl bg-white/10" />
                <div className="mt-4 h-24 animate-pulse rounded-2xl bg-white/10" />
              </div>
            </section>
            <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
              <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />
              <div className="h-80 animate-pulse rounded-[2rem] border border-white/10 bg-white/[0.04]" />
            </section>
          </>
        ) : !authenticated ? (
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-sm">
            <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                  User profile
                </p>
                <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Sign in to unlock your booking dashboard</h2>
                <p className="mt-3 max-w-xl text-sm text-white/60 sm:text-base">
                  View wallet balances, see recent bookings, and keep your upcoming sessions in one place.
                </p>
                <button
                  type="button"
                  onClick={login}
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white px-5 py-2.5 font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                >
                  Sign in
                </button>
              </div>
              <div className="grid gap-3">
                <InfoCard label="Balances" value="SOL + PUSD" detail="Track both wallet and token account status." />
                <InfoCard label="Recent bookings" value="Latest sessions" detail="See who you booked, when, and what you paid." />
                <InfoCard label="Upcoming" value="Next call ready" detail="Keep upcoming creator sessions front and center." />
              </div>
            </div>
          </section>
        ) : !walletAddress ? (
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04] backdrop-blur-sm">
            <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                  Wallet required
                </p>
                <h2 className="mt-3 text-3xl font-bold text-white sm:text-4xl">Connect your Solana wallet</h2>
                <p className="mt-3 max-w-xl text-sm text-white/60 sm:text-base">
                  Connect a wallet to load balances, recent bookings, and token account setup.
                </p>
                <button
                  type="button"
                  onClick={connectWallet}
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-white/15 bg-white px-5 py-2.5 font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                >
                  Connect wallet
                </button>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-[#0d1119] p-5">
                <p className="text-sm font-medium text-white">What you’ll get</p>
                <ul className="mt-4 space-y-3 text-sm text-white/60">
                  <li>Recent bookings and your next creator session</li>
                  <li>Live SOL and PUSD balances</li>
                  <li>Quick actions for copy, refresh, and token account setup</li>
                </ul>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[1.55fr_0.95fr]">
              <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(20,25,35,0.96),rgba(11,15,22,0.92))] p-6 shadow-[0_28px_90px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:p-8">
                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/40">
                      Wallet balance
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <p className="text-4xl font-bold tracking-tight text-white sm:text-6xl">
                        {loadingBalances && !balances
                          ? "Loading..."
                          : `${formatTokenAmount(balances?.pusd ?? 0, 2)} PUSD`}
                      </p>
                      <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-cyan-200">
                        {balances?.network === "devnet" ? "Devnet" : "Mainnet"}
                      </span>
                    </div>
                    <p className="mt-4 max-w-xl text-sm text-white/58 sm:text-base">
                      A calmer home for your wallet, booking activity, and upcoming calls.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        loadBalances();
                        loadBookings();
                      }}
                      disabled={loadingBalances || loadingBookings}
                      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/12 bg-white/6 px-4 text-white/72 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                    >
                      <span className="sr-only">Refresh account data</span>
                      <RefreshIcon spinning={loadingBalances || loadingBookings} />
                    </button>
                    <button
                      type="button"
                      onClick={copyWallet}
                      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/12 bg-white/6 px-4 text-sm font-medium text-white/78 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                    >
                      <span className="font-mono">{shortenAddress(walletAddress)}</span>
                      <CopyIcon />
                      <span>{copied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  <MetricCard
                    label="SOL balance"
                    value={loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.sol ?? 0, 6)} SOL`}
                    hint="Available in your connected wallet"
                  />
                  <MetricCard
                    label="Upcoming bookings"
                    value={loadingBookings && !bookingSummary ? "..." : String(upcomingCount)}
                    hint={nextBooking ? `Next: ${formatDateLabel(nextBooking.slot.startTime)}` : "No upcoming sessions yet"}
                  />
                  <MetricCard
                    label="Recent activity"
                    value={loadingBookings && !bookingSummary ? "..." : `${bookingCount} booking${bookingCount === 1 ? "" : "s"}`}
                    hint={
                      totalSpentPusd > 0 || totalSpentSol > 0
                        ? `Spent ${formatTokenAmount(totalSpentPusd, 2)} PUSD · ${formatTokenAmount(totalSpentSol, 4)} SOL`
                        : "Your booking history will show up here"
                    }
                  />
                </div>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                  Next session
                </p>
                {loadingBookings && !bookingSummary ? (
                  <div className="mt-5 space-y-3">
                    <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
                    <div className="h-20 animate-pulse rounded-2xl bg-white/10" />
                  </div>
                ) : nextBooking ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-[1.5rem] border border-cyan-400/15 bg-cyan-400/8 p-4">
                      <p className="text-sm font-medium text-cyan-100">@{nextBooking.creator.username}</p>
                      <p className="mt-2 text-2xl font-semibold text-white">
                        {formatDateLabel(nextBooking.slot.startTime)}
                      </p>
                      <p className="mt-2 text-sm text-white/60">
                        {formatTimeRange(nextBooking.slot.startTime, nextBooking.slot.endTime)}
                      </p>
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/8 px-3 py-1 text-xs font-medium text-white/75">
                          {formatAmount(nextBooking.amount, nextBooking.currency)}
                        </span>
                        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-medium text-emerald-200">
                          Upcoming
                        </span>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-white/10 bg-[#0e131c] p-4">
                      <p className="text-sm font-medium text-white">Need another slot?</p>
                      <p className="mt-2 text-sm text-white/58">
                        Browse more creators or revisit this creator’s page before the call.
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                          href={`/explore/${nextBooking.creator.username}`}
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-white/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                        >
                          View creator
                        </Link>
                        <Link
                          href="/explore"
                          className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                        >
                          Explore more
                        </Link>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/12 bg-[#0d1119] p-5">
                    <p className="text-lg font-semibold text-white">No upcoming sessions</p>
                    <p className="mt-2 text-sm text-white/58">
                      Once you book a creator slot, it will show up here with the next session time.
                    </p>
                    <Link
                      href="/explore"
                      className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                    >
                      Browse creators
                    </Link>
                  </div>
                )}
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.18fr_0.82fr]">
              <div className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                      Recent bookings
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-white">Your latest creator sessions</h2>
                  </div>
                  <Link
                    href="/explore"
                    className="hidden min-h-10 items-center justify-center rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b] sm:inline-flex"
                  >
                    Book again
                  </Link>
                </div>

                {bookingError ? (
                  <div className="mt-5 rounded-[1.5rem] border border-red-400/20 bg-red-500/10 p-4">
                    <p className="text-sm font-medium text-red-100">Couldn’t load your bookings</p>
                    <p className="mt-1 text-sm text-red-100/70">{bookingError}</p>
                    <button
                      type="button"
                      onClick={loadBookings}
                      className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-red-300/20 px-4 py-2 text-sm font-medium text-red-50 transition-colors hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                    >
                      Try again
                    </button>
                  </div>
                ) : loadingBookings && !bookingSummary ? (
                  <div className="mt-5 space-y-3">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <div key={index} className="h-24 animate-pulse rounded-[1.5rem] bg-white/8" />
                    ))}
                  </div>
                ) : bookings.length === 0 ? (
                  <div className="mt-5 rounded-[1.5rem] border border-dashed border-white/12 bg-[#0d1119] px-5 py-10 text-center">
                    <p className="text-lg font-semibold text-white">No recent bookings yet</p>
                    <p className="mt-2 text-sm text-white/58">
                      Your creator bookings will appear here once you complete your first session purchase.
                    </p>
                    <Link
                      href="/explore"
                      className="mt-5 inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                    >
                      Find a creator
                    </Link>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    {bookings.map((booking) => {
                      const phase = bookingPhase(booking.slot.startTime, booking.slot.endTime);
                      return (
                        <article
                          key={booking.id}
                          className="rounded-[1.5rem] border border-white/10 bg-[#0d1119] p-4 transition-colors hover:bg-[#111725]"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-base font-semibold text-white">@{booking.creator.username}</p>
                                <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/60">
                                  {phase}
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-white/62">
                                {formatDateLabel(booking.slot.startTime)} · {formatTimeRange(booking.slot.startTime, booking.slot.endTime)}
                              </p>
                              {booking.callFor && (
                                <p className="mt-2 line-clamp-2 text-sm text-white/50">
                                  {booking.callFor}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-col items-start gap-2 sm:items-end">
                              <p className="text-sm font-semibold text-cyan-200">
                                {formatAmount(booking.amount, booking.currency)}
                              </p>
                              <Link
                                href={`/explore/${booking.creator.username}`}
                                className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 px-3.5 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                              >
                                View creator
                              </Link>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    PUSD setup
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-white">Token account status</h2>
                  <p className="mt-2 text-sm text-white/58">
                    Keep your PUSD account ready for creator bookings that settle in stablecoins.
                  </p>
                  <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-[#0d1119] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-white">PUSD balance</p>
                        <p className="mt-2 text-3xl font-semibold text-white">
                          {loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.pusd ?? 0, 2)} PUSD`}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          balances?.pusdTokenAccountExists
                            ? "border border-emerald-400/20 bg-emerald-400/10 text-emerald-200"
                            : "border border-amber-300/20 bg-amber-300/10 text-amber-100"
                        }`}
                      >
                        {balances?.pusdTokenAccountExists ? "Ready" : "Setup needed"}
                      </span>
                    </div>

                    {balances && !balances.pusdTokenAccountExists && (
                      <div className="mt-4">
                        <p className="text-sm text-white/55">
                          No PUSD token account yet. Create it once with a small SOL rent payment.
                        </p>
                        <button
                          type="button"
                          onClick={handleCreatePusdAccount}
                          disabled={creatingPusdAccount}
                          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                        >
                          {creatingPusdAccount ? "Creating..." : "Create PUSD account"}
                        </button>
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 backdrop-blur-sm sm:p-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                    Identity
                  </p>
                  <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-[#0d1119] p-4">
                    <p className="text-lg font-semibold text-white">{email}</p>
                    <p className="mt-2 break-all font-mono text-sm text-white/48">{walletAddress}</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={copyWallet}
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 px-4 py-2 text-sm font-medium text-white/72 transition-colors hover:bg-white/8 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                      >
                        {copied ? "Wallet copied" : "Copy wallet"}
                      </button>
                      <Link
                        href="/explore"
                        className="inline-flex min-h-10 items-center justify-center rounded-full border border-white/12 bg-white px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#06070b]"
                      >
                        Browse creators
                      </Link>
                    </div>
                  </div>
                </section>
              </div>
            </section>

            {balanceError && (
              <div className="rounded-[1.5rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {balanceError}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.05] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/42">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/52">{hint}</p>
    </div>
  );
}

function InfoCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-[#0d1119] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/58">{detail}</p>
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
    >
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}
