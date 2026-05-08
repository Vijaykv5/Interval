"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useExportWallet, useWallets } from "@privy-io/react-auth/solana";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { SiteNav } from "@/components/site-nav";
import { getSelectedSolanaWalletChain } from "@/lib/solana-config";

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

function getProfileInitial(value: string | null) {
  if (!value) return "I";
  return value.trim().charAt(0).toUpperCase() || "I";
}

function formatProfileName(email: string | null | undefined, fallback = "Interval User") {
  if (!email) return fallback;
  const localPart = email.split("@")[0]?.trim();
  if (!localPart) return fallback;

  const normalized = localPart
    .replace(/[._-]+/g, " ")
    .replace(/\d+$/g, "")
    .trim();

  const candidate = normalized.length > 0 ? normalized : localPart;
  return candidate
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getLinkedAccountName(user: ReturnType<typeof usePrivy>["user"]) {
  const account = user?.linkedAccounts.find(
    (item): item is typeof item & { name: string } =>
      "name" in item && typeof item.name === "string" && item.name.trim().length > 0
  );

  return account?.name ?? null;
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
  const { ready, authenticated, login, connectWallet, getAccessToken, user } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const { exportWallet } = useExportWallet();
  const [balances, setBalances] = useState<BalanceData | null>(null);
  const [bookingSummary, setBookingSummary] = useState<BookingSummaryData | null>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"address" | "wallet" | "deposit" | "recovery" | null>(null);
  const [activeTab, setActiveTab] = useState<"sessions" | "rewards" | "wallet">("sessions");
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawRecipient, setWithdrawRecipient] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const wallet = wallets[0];
  const walletAddress = wallet?.address ?? null;
  const email =
    user?.linkedAccounts.find((account) => account.type === "google_oauth" && "email" in account)?.email ??
    user?.linkedAccounts.find((account) => account.type === "email" && "address" in account)?.address ??
    "Interval user";
  const profileName = getLinkedAccountName(user) ?? formatProfileName(email);

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
    setCopied("wallet");
    setTimeout(() => setCopied(null), 1800);
  }

  async function copyValue(value: string, target: "address" | "deposit" | "recovery") {
    await navigator.clipboard.writeText(value);
    setCopied(target);
    setTimeout(() => setCopied(null), 1800);
  }

  async function openExportModal() {
    setExportModalOpen(true);
    setRecoveryLoading(true);
    setRecoveryError(null);
    setRecoveryKey(null);

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
          setExportModalOpen(false);
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
  }

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault();
    setWithdrawError(null);

    if (!wallet || !walletAddress) {
      setWithdrawError("Connect your wallet first.");
      return;
    }

    const amountNum = parseFloat(withdrawAmount);
    const recipient = withdrawRecipient.trim();

    if (Number.isNaN(amountNum) || amountNum <= 0) {
      setWithdrawError("Enter a valid amount greater than 0.");
      return;
    }

    if (!recipient || recipient.length < 32) {
      setWithdrawError("Enter a valid Solana recipient address.");
      return;
    }

    const availableBalance = balances?.sol ?? 0;
    if (amountNum > availableBalance) {
      setWithdrawError(`Insufficient balance. Available: ${availableBalance.toFixed(4)} SOL`);
      return;
    }

    setWithdrawing(true);
    try {
      const lamports = Math.floor(amountNum * LAMPORTS_PER_SOL);
      const instruction = SystemProgram.transfer({
        fromPubkey: new PublicKey(walletAddress),
        toPubkey: new PublicKey(recipient),
        lamports,
      });

      const transaction = new Transaction();
      transaction.add(instruction);
      transaction.feePayer = new PublicKey(walletAddress);

      const blockhashRes = await fetch("/api/solana/blockhash");
      if (!blockhashRes.ok) {
        const data = await blockhashRes.json().catch(() => ({}));
        throw new Error(data?.error ?? "Failed to get blockhash");
      }

      const { blockhash } = await blockhashRes.json();
      transaction.recentBlockhash = blockhash;

      const txBytes = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });

      await signAndSendTransaction({
        transaction: new Uint8Array(txBytes),
        wallet,
        chain: getSelectedSolanaWalletChain(),
      });

      toast.success("Withdrawal successful!");
      setWithdrawModalOpen(false);
      setWithdrawAmount("");
      setWithdrawRecipient("");
      await loadBalances();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Withdrawal failed.";
      setWithdrawError(message);
      toast.error(message);
    } finally {
      setWithdrawing(false);
    }
  }

  const bookings = bookingSummary?.bookings ?? [];
  const bookingCount = bookings.length;
  const rewardsPoints = bookingCount * 25;

  return (
    <div className="min-h-screen bg-[#060606] text-white">
      <div
        className="pointer-events-none fixed inset-0 opacity-95"
        style={{
          background:
            "radial-gradient(circle at 16% 12%, rgba(255, 191, 120, 0.06) 0, transparent 22%), radial-gradient(circle at 84% 12%, rgba(255, 140, 66, 0.07) 0, transparent 18%), linear-gradient(180deg, #050505 0%, #090909 44%, #050505 100%)",
        }}
      />
      <SiteNav />
      <main className="relative mx-auto flex w-full max-w-[1280px] flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        {!ready ? (
          <section className="rounded-[2rem] border border-white/10 bg-[#161616] p-6">
            <div className="h-36 animate-pulse rounded-[1.5rem] bg-white/8" />
            <div className="mt-6 h-10 w-48 animate-pulse rounded-full bg-white/8" />
            <div className="mt-6 h-72 animate-pulse rounded-[1.5rem] bg-white/8" />
          </section>
        ) : !authenticated ? (
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#161616] shadow-[0_26px_80px_rgba(0,0,0,0.24)]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                  User profile
                </p>
                <h2
                  className="mt-3 text-3xl font-bold text-white sm:text-4xl"
                  style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
                >
                  Sign in to see your bookings in one place
                </h2>
                <p className="mt-3 max-w-xl text-sm text-white/55 sm:text-base">
                  Keep your upcoming calls, balances, and recent creator sessions on a single quiet screen.
                </p>
                <button
                  type="button"
                  onClick={login}
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-[#ffd28e]/20 bg-[#ffd28e] px-5 py-2.5 font-semibold text-black transition-colors hover:bg-[#ffc97a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                >
                  Sign in
                </button>
              </div>
              <div className="grid gap-3">
                <InfoCard label="Balances" value="SOL + PUSD" detail="Check wallet funds and PUSD readiness." />
                <InfoCard label="Recent bookings" value="Clean history" detail="See who you booked and when each call happens." />
                <InfoCard label="Next session" value="Always visible" detail="Your next booking stays front and center." />
              </div>
            </div>
          </section>
        ) : !walletAddress ? (
          <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#161616]">
            <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
                  Wallet required
                </p>
                <h2
                  className="mt-3 text-3xl font-bold text-white sm:text-4xl"
                  style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
                >
                  Connect your Solana wallet
                </h2>
                <p className="mt-3 max-w-xl text-sm text-white/55 sm:text-base">
                  Once your wallet is connected, we can load your balances, booking activity, and token setup status.
                </p>
                <button
                  type="button"
                  onClick={connectWallet}
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-[#ffd28e]/20 bg-[#ffd28e] px-5 py-2.5 font-semibold text-black transition-colors hover:bg-[#ffc97a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                >
                  Connect wallet
                </button>
              </div>
              <div className="rounded-[1.75rem] border border-white/10 bg-[#1d1d1d] p-5">
                <p className="text-sm font-medium text-white">What you’ll get</p>
                <ul className="mt-4 space-y-3 text-sm text-white/55">
                  <li>Recent bookings and your next creator session</li>
                  <li>Live SOL and PUSD balances</li>
                  <li>Quick actions for copy, refresh, and token account setup</li>
                </ul>
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(18,18,18,0.92),rgba(14,14,14,0.94))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2b9a69,#1f7c55)] text-4xl font-semibold text-white shadow-[0_16px_44px_rgba(34,139,93,0.24)]">
                    {getProfileInitial(email)}
                  </div>
                  <div>
                    <p
                      className="text-3xl font-semibold uppercase text-white sm:text-4xl"
                      style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
                    >
                      {profileName}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-white/48">
                      <span className="font-mono text-lg">{shortenAddress(walletAddress)}</span>
                      <button
                        type="button"
                        onClick={copyWallet}
                        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-[#1a1a1a] text-white/76 transition-colors hover:bg-[#202020] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                        aria-label="Copy wallet"
                      >
                        <AnimatedStatusIcon copied={copied === "wallet"} />
                      </button>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <BalancePill
                        label="SOL"
                        value={loadingBalances && !balances ? "..." : formatTokenAmount(balances?.sol ?? 0, 6)}
                      />
                      <BalancePill
                        label="PUSD"
                        value={loadingBalances && !balances ? "..." : formatTokenAmount(balances?.pusd ?? 0, 2)}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setDepositModalOpen(true)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                  >
                    Deposit
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(true)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#121212] px-6 py-2.5 text-sm font-medium text-white/82 transition-colors hover:bg-[#191919] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                  >
                    Withdraw
                  </button>
                  <button
                    type="button"
                    onClick={openExportModal}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#121212] px-6 py-2.5 text-sm font-medium text-white/82 transition-colors hover:bg-[#191919] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                  >
                    Export Wallet
                  </button>
                </div>
              </div>

              <div className="mt-8 flex gap-8">
                <TabButton
                  label="Sessions"
                  active={activeTab === "sessions"}
                  onClick={() => setActiveTab("sessions")}
                />
                <TabButton
                  label="Rewards"
                  active={activeTab === "rewards"}
                  onClick={() => setActiveTab("rewards")}
                />
                <TabButton
                  label="Wallet"
                  active={activeTab === "wallet"}
                  onClick={() => setActiveTab("wallet")}
                />
              </div>

              <div className="mt-8">
                {activeTab === "sessions" && (
                  <>
                    {bookingError ? (
                      <div className="rounded-[1.5rem] bg-red-500/10 p-4">
                        <p className="text-sm font-medium text-red-100">Couldn’t load your sessions</p>
                        <p className="mt-1 text-sm text-red-100/70">{bookingError}</p>
                        <button
                          type="button"
                          onClick={loadBookings}
                          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-full border border-red-300/20 px-4 py-2 text-sm font-medium text-red-50 transition-colors hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                        >
                          Try again
                        </button>
                      </div>
                    ) : loadingBookings && !bookingSummary ? (
                      <div className="space-y-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <div key={index} className="h-24 animate-pulse rounded-[1.5rem] bg-white/8" />
                        ))}
                      </div>
                    ) : bookings.length === 0 ? (
                      <EmptyPanel
                        title="No sessions yet"
                        description="Start booking creators to see your sessions here."
                        actionLabel="Browse creators"
                        actionHref="/explore"
                      />
                    ) : (
                      <div className="grid gap-3">
                        {bookings.map((booking) => {
                          const phase = bookingPhase(booking.slot.startTime, booking.slot.endTime);
                          return (
                            <article
                              key={booking.id}
                              className="rounded-[1.5rem] bg-[#101010] p-4 transition-colors hover:bg-[#131313]"
                            >
                              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-base font-semibold text-white">@{booking.creator.username}</p>
                                    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-white/52">
                                      {phase}
                                    </span>
                                  </div>
                                  <p className="mt-2 text-sm text-white/58">
                                    {formatDateLabel(booking.slot.startTime)} · {formatTimeRange(booking.slot.startTime, booking.slot.endTime)}
                                  </p>
                                  {booking.callFor && (
                                    <p className="mt-2 line-clamp-2 text-sm text-white/42">
                                      {booking.callFor}
                                    </p>
                                  )}
                                </div>

                                <div className="flex flex-col items-start gap-2 sm:items-end">
                                  <p className="text-sm font-semibold text-[#ffd28e]">
                                    {formatAmount(booking.amount, booking.currency)}
                                  </p>
                                  <Link
                                    href={`/explore/${booking.creator.username}`}
                                    className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#171717] px-3.5 py-2 text-sm font-medium text-white/76 transition-colors hover:bg-[#1f1f1f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
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
                  </>
                )}

                {activeTab === "rewards" && (
                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-[1.5rem] bg-[#101010] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Rewards balance</p>
                      <p className="mt-4 text-4xl font-semibold text-white">{rewardsPoints}</p>
                      <p className="mt-2 text-sm text-white/48">
                        Earned from booked sessions on Interval.
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] bg-[#101010] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">How rewards work</p>
                      <div className="mt-4 space-y-3 text-sm text-white/48">
                        <p>Every completed booking adds reward points to your account.</p>
                        <p>More reward features and perks can live here later without changing this layout.</p>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "wallet" && (
                  <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="rounded-[1.5rem] bg-[#101010] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Wallet balance</p>
                      <p className="mt-4 text-4xl font-semibold text-white">
                        {loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.sol ?? 0, 6)} SOL`}
                      </p>
                      <p className="mt-2 text-sm text-white/48">
                        Connected wallet available on {balances?.network === "devnet" ? "devnet" : "mainnet"}.
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] bg-[#101010] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">PUSD balance</p>
                      <p className="mt-4 text-4xl font-semibold text-white">
                        {loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.pusd ?? 0, 2)} PUSD`}
                      </p>
                      <p className="mt-2 text-sm text-white/48">
                        Your token account will be created automatically when PUSD is deposited.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {balanceError && (
              <div className="rounded-[1.5rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {balanceError}
              </div>
            )}

            {depositModalOpen && (
              <ProfileModal
                title="Deposit SOL"
                onClose={() => setDepositModalOpen(false)}
              >
                <div className="space-y-5">
                  <ModalField
                    label="Address"
                    value={shortenAddress(walletAddress ?? "")}
                    trailingAction={
                      walletAddress ? (
                        <button
                          type="button"
                          onClick={() => void copyValue(walletAddress, "deposit")}
                          className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-[#1f1f1f] text-white/76 transition-colors hover:bg-[#272727] hover:text-white"
                          aria-label="Copy deposit address"
                        >
                          <AnimatedStatusIcon copied={copied === "deposit"} />
                        </button>
                      ) : null
                    }
                  />
                  <ModalField
                    label="Balance"
                    value={loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.sol ?? 0, 4)} SOL`}
                  />
                  {walletAddress && (
                    <button
                      type="button"
                      onClick={() => void copyValue(walletAddress, "address")}
                      className="w-full rounded-[1.25rem] bg-white px-5 py-4 text-base font-semibold text-black transition-colors hover:bg-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]"
                    >
                      {copied === "address" ? "Address copied" : "Copy Address"}
                    </button>
                  )}
                </div>
              </ProfileModal>
            )}

            {withdrawModalOpen && (
              <ProfileModal
                title="Withdraw SOL"
                onClose={() => !withdrawing && setWithdrawModalOpen(false)}
              >
                <form onSubmit={handleWithdraw} className="space-y-5">
                  {withdrawError && (
                    <div className="rounded-[1.25rem] bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {withdrawError}
                    </div>
                  )}
                  <div>
                    <label htmlFor="withdraw-amount" className="mb-2 block text-sm font-medium text-white/72">
                      Amount
                    </label>
                    <div className="rounded-[1.25rem] bg-[#161616] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <input
                          id="withdraw-amount"
                          type="number"
                          step="0.0001"
                          min="0"
                          placeholder="0.00"
                          value={withdrawAmount}
                          onChange={(e) => {
                            setWithdrawAmount(e.target.value);
                            setWithdrawError(null);
                          }}
                          className="flex-1 bg-transparent text-xl font-semibold text-white placeholder:text-white/28 focus:outline-none [color-scheme:dark]"
                        />
                        <span className="text-sm font-medium text-white/48">SOL</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-white/38">
                      Available: {loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.sol ?? 0, 4)} SOL`}
                    </p>
                  </div>
                  <div>
                    <label htmlFor="withdraw-recipient" className="mb-2 block text-sm font-medium text-white/72">
                      Recipient address
                    </label>
                    <textarea
                      id="withdraw-recipient"
                      value={withdrawRecipient}
                      onChange={(e) => {
                        setWithdrawRecipient(e.target.value);
                        setWithdrawError(null);
                      }}
                      placeholder="Enter Solana recipient address"
                      rows={3}
                      className="w-full resize-none rounded-[1.25rem] bg-[#161616] px-4 py-3 text-white placeholder:text-white/28 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 [color-scheme:dark]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={withdrawing}
                    className="w-full rounded-[1.25rem] bg-white px-5 py-4 text-base font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]"
                  >
                    {withdrawing ? "Withdrawing..." : "Withdraw"}
                  </button>
                </form>
              </ProfileModal>
            )}

            {exportModalOpen && (
              <ProfileModal
                title="Export Wallet"
                onClose={() => !recoveryLoading && setExportModalOpen(false)}
              >
                <div className="space-y-5">
                  {recoveryError && (
                    <div className="rounded-[1.25rem] bg-red-500/10 px-4 py-3 text-sm text-red-100">
                      {recoveryError}
                    </div>
                  )}
                  {recoveryLoading && !recoveryKey ? (
                    <div className="rounded-[1.25rem] bg-[#161616] px-4 py-6 text-sm text-white/58">
                      Loading recovery key...
                    </div>
                  ) : recoveryKey ? (
                    <>
                      <ModalField
                        label="Recovery key"
                        value={recoveryKey}
                        mono
                        trailingAction={
                          <button
                            type="button"
                            onClick={() => void copyValue(recoveryKey, "recovery")}
                            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-[#1f1f1f] text-white/76 transition-colors hover:bg-[#272727] hover:text-white"
                            aria-label="Copy recovery key"
                          >
                            <AnimatedStatusIcon copied={copied === "recovery"} />
                          </button>
                        }
                      />
                      <p className="text-sm text-white/42">
                        Store this securely. Anyone with this key can control your wallet.
                      </p>
                    </>
                  ) : null}
                </div>
              </ProfileModal>
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
    <div className="rounded-[1.5rem] bg-[#121212] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/48">{hint}</p>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-11 pb-3 text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606] ${
        active
          ? "text-white"
          : "text-white/45 hover:text-white/72"
      }`}
    >
      {label}
      {active && <span className="absolute inset-x-0 bottom-0 h-px bg-white/80" />}
    </button>
  );
}

function ProfileModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="w-full max-w-xl rounded-[1.75rem] bg-[#0f0f0f] p-5 shadow-2xl sm:p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-4">
            <h3
              className="text-2xl font-semibold text-white sm:text-3xl"
              style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
            >
              {title}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-[#171717] text-white/62 transition-colors hover:bg-[#202020] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]"
              aria-label="Close modal"
            >
              <CloseIcon />
            </button>
          </div>
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </>
  );
}

function ModalField({
  label,
  value,
  trailingAction,
  mono = false,
}: {
  label: string;
  value: string;
  trailingAction?: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-medium text-white/68">{label}</p>
      <div className="flex items-center gap-3 rounded-[1.25rem] bg-[#161616] px-4 py-4">
        <div className={`min-w-0 flex-1 break-all text-white ${mono ? "font-mono text-sm" : "text-xl font-semibold"}`}>
          {value}
        </div>
        {trailingAction}
      </div>
    </div>
  );
}

function EmptyPanel({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex min-h-[340px] items-center justify-center rounded-[1.5rem] bg-[#101010] px-6 py-10 text-center">
      <div className="max-w-md">
        <p className="text-2xl font-semibold text-white">{title}</p>
        <p className="mt-3 text-sm text-white/48">{description}</p>
        <Link
          href={actionHref}
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-[#ffd28e] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#ffc97a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
        >
          {actionLabel}
        </Link>
      </div>
    </div>
  );
}

function BalancePill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-full bg-[#111111] px-4 py-3 shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/38">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function AnimatedStatusIcon({ copied }: { copied: boolean }) {
  return copied ? <CheckIcon /> : <CopyIcon />;
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
    <div className="rounded-[1.5rem] border border-white/10 bg-[#121212] p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">{label}</p>
      <p className="mt-3 text-xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-white/48">{detail}</p>
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

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 text-[#ffb15c] transition-all duration-200"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m5 12 5 5L20 7" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="h-5 w-5"
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
