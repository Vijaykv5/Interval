"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DodoPayments } from "dodopayments-checkout";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { useSolanaNetwork } from "@/components/network-provider";
import { SiteNav } from "@/components/site-nav";
import { useUserWallet } from "@/components/user-wallet-provider";
import { DODO_TOPUP_PACKS, type DodoTopupPack } from "@/lib/dodo-topup-packs";
import { ensurePusdTokenAccount } from "@/lib/pusd";
import { getSelectedSolanaWalletChain, hasConfiguredPusdMint } from "@/lib/solana-config";

type BalanceData = {
  wallet: string;
  network: string;
  sol: number;
  pusd: number;
  usdc: number;
  bookingCreditsUsd: number;
  bookingCreditsCents: number;
  pusdTokenAccountExists: boolean;
  pusdAta: string;
  usdcTokenAccountExists: boolean;
  usdcAta: string;
};

type UserBooking = {
  id: string;
  amount: number;
  currency: "SOL" | "PUSD" | "USDC";
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
    USDC: number;
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

function formatTokenAmount(amount: number, decimals: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: amount === 0 ? 2 : 0,
    maximumFractionDigits: decimals,
  });
}

function formatAmount(amount: number, currency: "SOL" | "PUSD" | "USDC") {
  return `${formatTokenAmount(amount, currency === "SOL" ? 4 : 2)} ${currency}`;
}

function formatUsdAmount(amount: number) {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function getPusdProvisionSessionKey(network: string, walletAddress: string) {
  return `interval:profile:pusd-ata:${network}:${walletAddress}`;
}

function getDodoTopupSessionKey(walletAddress: string) {
  return `interval:profile:dodo-topup:${walletAddress}`;
}

const BALANCE_POLL_INTERVAL_MS = 10 * 60 * 1000;

export default function ProfilePage() {
  const searchParams = useSearchParams();
  const {
    ready,
    connected,
    wallet,
    walletAddress,
    openConnectModal,
    signAndSendTransaction,
  } = useUserWallet();
  const { network } = useSolanaNetwork();
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
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawRecipient, setWithdrawRecipient] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [topupLoadingPackId, setTopupLoadingPackId] = useState<string | null>(null);
  const [topupProcessingMessage, setTopupProcessingMessage] = useState<string | null>(null);
  const [authSettled, setAuthSettled] = useState(false);
  const pusdProvisionInFlightRef = useRef<string | null>(null);
  const activeTopupIdRef = useRef<string | null>(null);
  const topupPollingRef = useRef<string | null>(null);
  const dodoInitializedRef = useRef(false);

  const profileName = "Interval User";

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
    if (!walletAddress) return;

    const intervalId = window.setInterval(() => {
      void loadBalances();
    }, BALANCE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [loadBalances, walletAddress]);

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

  const clearTopupSearchParams = useCallback(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.delete("topup");
    url.searchParams.delete("topupId");
    url.searchParams.delete("status");
    url.searchParams.delete("payment_id");
    window.history.replaceState({}, "", url.toString());
  }, []);

  const clearStoredTopup = useCallback(() => {
    if (!walletAddress || typeof window === "undefined") return;
    window.sessionStorage.removeItem(getDodoTopupSessionKey(walletAddress));
  }, [walletAddress]);

  const pollTopupStatus = useCallback(
    async (topupId: string) => {
      if (!walletAddress || topupPollingRef.current === topupId) return;

      topupPollingRef.current = topupId;
      activeTopupIdRef.current = topupId;
      setTopupProcessingMessage("Confirming your Dodo payment and crediting your dashboard...");

      try {
        for (let attempt = 0; attempt < 25; attempt += 1) {
          const res = await fetch(
            `/api/dodo/topups/status?topupId=${encodeURIComponent(topupId)}&wallet=${encodeURIComponent(walletAddress)}`,
            { cache: "no-store" }
          );
          const data = await res.json().catch(() => ({}));

          if (res.ok) {
            if (data.status === "succeeded") {
              await loadBalances();
              clearStoredTopup();
              clearTopupSearchParams();
              activeTopupIdRef.current = null;
              setTopupLoadingPackId(null);
              setTopupProcessingMessage(null);
              setDepositModalOpen(false);
              toast.success(`$${data.amountUsd} booking credits added.`, {
                description: `Your new credit balance is $${data.creditBalanceUsd}.`,
              });
              return;
            }

            if (data.status === "failed" || data.status === "cancelled") {
              clearStoredTopup();
              clearTopupSearchParams();
              activeTopupIdRef.current = null;
              setTopupLoadingPackId(null);
              setTopupProcessingMessage(null);
              toast.error("Top-up did not complete. Please try again.");
              return;
            }
          }

          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }

        setTopupLoadingPackId(null);
        setTopupProcessingMessage(
          "Payment received. Credits will appear here as soon as Dodo finishes confirming the webhook."
        );
      } finally {
        topupPollingRef.current = null;
      }
    },
    [clearStoredTopup, clearTopupSearchParams, loadBalances, walletAddress]
  );

  const startTopup = useCallback(
    async (pack: DodoTopupPack) => {
      if (!walletAddress) {
        toast.error("Connect your wallet before topping up.");
        return;
      }

      setTopupLoadingPackId(pack.id);
      setTopupProcessingMessage(null);

      try {
        const res = await fetch("/api/dodo/topups/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress,
            packId: pack.id,
          }),
        });
        const data = await res.json().catch(() => ({}));

        if (!res.ok || typeof data.checkoutUrl !== "string" || typeof data.topupId !== "string") {
          throw new Error(data?.error ?? "Could not start the Dodo checkout.");
        }

        activeTopupIdRef.current = data.topupId;
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(getDodoTopupSessionKey(walletAddress), data.topupId);
        }

        await DodoPayments.Checkout.open({
          checkoutUrl: data.checkoutUrl,
          options: {
            showSecurityBadge: true,
            themeConfig: {
              dark: {
                bgPrimary: "#0D0D0D",
                bgSecondary: "#171717",
                borderPrimary: "#323232",
                borderSecondary: "#909090",
                textPrimary: "#FFFFFF",
                textSecondary: "#A1A1AA",
                textPlaceholder: "#71717A",
                textError: "#F97066",
                textSuccess: "#34D399",
                buttonPrimary: "#FFD28E",
                buttonPrimaryHover: "#FFC97A",
                buttonTextPrimary: "#0D0D0D",
                buttonSecondary: "#232323",
                buttonSecondaryHover: "#2E2E2E",
                buttonTextSecondary: "#FFFFFF",
              },
              radius: "18px",
            },
          },
        });
      } catch (error) {
        activeTopupIdRef.current = null;
        clearStoredTopup();
        setTopupLoadingPackId(null);
        setTopupProcessingMessage(null);
        toast.error(error instanceof Error ? error.message : "Could not open Dodo checkout.");
      }
    },
    [clearStoredTopup, walletAddress]
  );

  const bookings = bookingSummary?.bookings ?? [];
  const bookingCount = bookings.length;
  const rewardsPoints = bookingCount * 40;
  const bookedNow = searchParams.get("booked") === "1";
  const selectedBookingId = searchParams.get("booking");
  const kiraPayError = searchParams.get("kirapay") === "error";
  const kiraPayMessage = searchParams.get("message");
  const dodoTopupRequested = searchParams.get("topup") === "1";
  const dodoTopupId = searchParams.get("topupId");
  const highlightedBooking = selectedBookingId
    ? bookings.find((booking) => booking.id === selectedBookingId) ?? null
    : bookingSummary?.nextBooking ?? null;

  useEffect(() => {
    if (!bookedNow || !selectedBookingId || !bookingSummary) return;
    if (!highlightedBooking) return;

    toast.success("Booking saved to your profile.", {
      description: `You can find your session with @${highlightedBooking.creator.username} below.`,
    });
  }, [bookedNow, selectedBookingId, bookingSummary, highlightedBooking]);

  useEffect(() => {
    if (!kiraPayError) return;

    toast.error(kiraPayMessage || "KIRAPAY checkout did not complete.");
  }, [kiraPayError, kiraPayMessage]);

  useEffect(() => {
    if (dodoInitializedRef.current) return;

    DodoPayments.Initialize({
      mode: process.env.NEXT_PUBLIC_DODO_PAYMENTS_MODE === "live" ? "live" : "test",
      displayType: "overlay",
      onEvent: (event) => {
        if (event.event_type === "checkout.error") {
          setTopupLoadingPackId(null);
          setTopupProcessingMessage(null);
          toast.error(
            typeof event.data?.message === "string"
              ? event.data.message
              : "Dodo checkout failed to load."
          );
        }

        if (event.event_type === "checkout.closed" && activeTopupIdRef.current) {
          void pollTopupStatus(activeTopupIdRef.current);
        }
      },
    });

    dodoInitializedRef.current = true;
  }, [pollTopupStatus]);

  useEffect(() => {
    if (!walletAddress) return;

    const storedTopupId =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem(getDodoTopupSessionKey(walletAddress))
        : null;
    const topupId = dodoTopupRequested && dodoTopupId ? dodoTopupId : storedTopupId;

    if (!topupId || topupPollingRef.current === topupId) {
      return;
    }

    void pollTopupStatus(topupId);
  }, [dodoTopupId, dodoTopupRequested, pollTopupStatus, walletAddress]);

  useEffect(() => {
    if (!ready) {
      setAuthSettled(false);
      return;
    }

    if (connected) {
      setAuthSettled(true);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAuthSettled(true);
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [connected, ready]);

  useEffect(() => {
    if (!ready || !connected) return;
    if (!hasConfiguredPusdMint(network)) return;
    if (!wallet || !walletAddress) return;

    const sessionKey = getPusdProvisionSessionKey(network, walletAddress);
    if (typeof window !== "undefined") {
      const status = window.sessionStorage.getItem(sessionKey);
      if (status === "done" || status === "failed") {
        return;
      }
    }

    if (pusdProvisionInFlightRef.current === sessionKey) {
      return;
    }

    pusdProvisionInFlightRef.current = sessionKey;

    void ensurePusdTokenAccount({
      wallet,
      walletAddress,
      signAndSendTransaction,
      network,
    })
      .then(async (result) => {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(sessionKey, "done");
        }

        if (result.created) {
          await loadBalances();
        }
      })
      .catch((error) => {
        console.error("Automatic PUSD token account setup on profile failed:", error);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(sessionKey, "failed");
        }
      })
      .finally(() => {
        if (pusdProvisionInFlightRef.current === sessionKey) {
          pusdProvisionInFlightRef.current = null;
        }
      });
  }, [
    connected,
    loadBalances,
    network,
    ready,
    signAndSendTransaction,
    wallet,
    walletAddress,
  ]);

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
        {!ready || !authSettled ? (
          <section className="rounded-[2rem] border border-white/10 bg-[#161616] p-6">
            <div className="h-36 animate-pulse rounded-[1.5rem] bg-white/8" />
            <div className="mt-6 h-10 w-48 animate-pulse rounded-full bg-white/8" />
            <div className="mt-6 h-72 animate-pulse rounded-[1.5rem] bg-white/8" />
          </section>
        ) : !connected ? (
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
                  Connect your wallet to see your bookings in one place
                </h2>
                <p className="mt-3 max-w-xl text-sm text-white/55 sm:text-base">
                  Keep your upcoming calls, balances, and recent creator sessions on a single quiet screen.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      openConnectModal();
                    } catch (connectError) {
                      toast.error(
                        connectError instanceof Error
                          ? connectError.message
                          : "Wallet connection failed."
                      );
                    }
                  }}
                  className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full border border-[#ffd28e]/20 bg-[#ffd28e] px-5 py-2.5 font-semibold text-black transition-colors hover:bg-[#ffc97a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                >
                  Connect wallet
                </button>
              </div>
              <div className="grid gap-3">
                <InfoCard label="Balances" value="SOL + PUSD + USDC" detail="Check wallet funds and token readiness." />
                <InfoCard label="Recent bookings" value="Clean history" detail="See who you booked and when each call happens." />
                <InfoCard label="Next session" value="Always visible" detail="Your next booking stays front and center." />
              </div>
            </div>
          </section>
        ) : (
          <>
            <section className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(18,18,18,0.92),rgba(14,14,14,0.94))] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.22)] sm:p-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[linear-gradient(180deg,#2b9a69,#1f7c55)] text-4xl font-semibold text-white shadow-[0_16px_44px_rgba(34,139,93,0.24)]">
                    {getProfileInitial(walletAddress)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-3 text-white/60">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#ffd28e]/74">
                        Connected wallet
                      </span>
                      <button
                        type="button"
                        onClick={copyWallet}
                        className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-[#1a1a1a] text-white/76 transition-colors hover:bg-[#202020] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                        aria-label="Copy wallet"
                      >
                        <AnimatedStatusIcon copied={copied === "wallet"} />
                      </button>
                    </div>
                    <p className="mt-3 break-all font-mono text-[1.15rem] leading-7 text-white sm:text-[1.35rem]">
                      {walletAddress ?? ""}
                    </p>
                    <p
                      className="mt-5 text-3xl font-semibold uppercase text-white sm:text-4xl"
                      style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
                    >
                      {profileName}
                    </p>
                    <p className="mt-2 text-sm text-white/48">
                      Track your sessions, wallet balances, and reward progress from one place.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <BalancePill
                        label="SOL"
                        value={loadingBalances && !balances ? "..." : formatTokenAmount(balances?.sol ?? 0, 6)}
                      />
                      <BalancePill
                        label="PUSD"
                        value={loadingBalances && !balances ? "..." : formatTokenAmount(balances?.pusd ?? 0, 2)}
                      />
                      <BalancePill
                        label="USDC"
                        value={loadingBalances && !balances ? "..." : formatTokenAmount(balances?.usdc ?? 0, 2)}
                      />
                      <BalancePill
                        label="Credits"
                        value={loadingBalances && !balances ? "..." : `$${formatUsdAmount(balances?.bookingCreditsUsd ?? 0)}`}
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
                    Top up
                  </button>
                  <button
                    type="button"
                    onClick={() => setWithdrawModalOpen(true)}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#121212] px-6 py-2.5 text-sm font-medium text-white/82 transition-colors hover:bg-[#191919] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                  >
                    Withdraw
                  </button>
                </div>
              </div>

              <div className="mt-8 rounded-[1.75rem] border border-[#ffd28e]/20 bg-[linear-gradient(135deg,rgba(255,210,142,0.12),rgba(255,210,142,0.03)_42%,rgba(18,18,18,0.94))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd28e]/74">
                      Rewards boost
                    </p>
                    <h3 className="mt-3 text-xl font-semibold text-white sm:text-2xl">
                      Pay with PUSD and earn 40 reward points per booking
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-white/62 sm:text-[15px]">
                      Stablecoin bookings stack points faster and keep your checkout flow simple. Every PUSD payment adds a cleaner reward bonus to your profile.
                    </p>
                  </div>
                  <div className="rounded-[1.35rem] border border-white/10 bg-black/20 px-5 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/42">
                      Bonus rate
                    </p>
                    <p className="mt-2 text-3xl font-semibold text-[#ffd28e]">+40 pts</p>
                    <p className="mt-1 text-sm text-white/48">for each PUSD booking</p>
                  </div>
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
                        {highlightedBooking && (
                          <section className="rounded-[1.75rem] border border-[#ffd28e]/20 bg-[linear-gradient(180deg,rgba(255,210,142,0.08),rgba(20,20,20,0.94))] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd28e]/72">
                                  {bookedNow ? "Booking confirmed" : "Next session"}
                                </p>
                                <h3 className="mt-3 text-2xl font-semibold text-white">
                                  @{highlightedBooking.creator.username}
                                </h3>
                                <p className="mt-2 text-sm text-white/60">
                                  {formatDateLabel(highlightedBooking.slot.startTime)} ·{" "}
                                  {formatTimeRange(highlightedBooking.slot.startTime, highlightedBooking.slot.endTime)}
                                </p>
                                {highlightedBooking.callFor && (
                                  <p className="mt-3 max-w-2xl text-sm leading-6 text-white/72">
                                    {highlightedBooking.callFor}
                                  </p>
                                )}
                              </div>

                              <div className="grid gap-2 text-sm text-white/64 sm:grid-cols-2 lg:min-w-[320px]">
                                <DetailPill label="Status" value={highlightedBooking.status} />
                                <DetailPill
                                  label="Payment"
                                  value={formatAmount(highlightedBooking.amount, highlightedBooking.currency)}
                                />
                                <DetailPill
                                  label="Booked on"
                                  value={formatDateLabel(highlightedBooking.createdAt)}
                                />
                                <DetailPill
                                  label="Phase"
                                  value={bookingPhase(
                                    highlightedBooking.slot.startTime,
                                    highlightedBooking.slot.endTime
                                  )}
                                />
                              </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-3">
                              <Link
                                href={`/explore/${highlightedBooking.creator.username}`}
                                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ffd28e] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#ffc97a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                              >
                                View creator
                              </Link>
                              {highlightedBooking.slot.meetLink ? (
                                <a
                                  href={highlightedBooking.slot.meetLink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#171717] px-5 py-2.5 text-sm font-medium text-white/82 transition-colors hover:bg-[#1f1f1f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                                >
                                  Open meeting link
                                </a>
                              ) : null}
                            </div>
                          </section>
                        )}

                        {bookings.map((booking) => {
                          const phase = bookingPhase(booking.slot.startTime, booking.slot.endTime);
                          const isHighlighted = booking.id === highlightedBooking?.id;
                          return (
                            <article
                              key={booking.id}
                              className={`rounded-[1.5rem] p-4 transition-colors hover:bg-[#131313] ${
                                isHighlighted
                                  ? "border border-[#ffd28e]/25 bg-[#14110b]"
                                  : "bg-[#101010]"
                              }`}
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
                                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/42">
                                    <span>Status: {booking.status}</span>
                                    <span>Booked: {formatDateLabel(booking.createdAt)}</span>
                                  </div>
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
                                  <div className="flex flex-wrap gap-2 sm:justify-end">
                                    {booking.slot.meetLink ? (
                                      <a
                                        href={booking.slot.meetLink}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#1d1d1d] px-3.5 py-2 text-sm font-medium text-white/76 transition-colors hover:bg-[#242424] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                                      >
                                        Join meeting
                                      </a>
                                    ) : null}
                                    <Link
                                      href={`/explore/${booking.creator.username}`}
                                      className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#171717] px-3.5 py-2 text-sm font-medium text-white/76 transition-colors hover:bg-[#1f1f1f] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060606]"
                                    >
                                      View creator
                                    </Link>
                                  </div>
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
                        Based on 40 reward points for each booking tracked on Interval.
                      </p>
                    </div>
                    <div className="rounded-[1.5rem] border border-[#ffd28e]/14 bg-[linear-gradient(180deg,rgba(255,210,142,0.08),rgba(16,16,16,0.96))] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ffd28e]/72">How rewards work</p>
                      <div className="mt-4 space-y-3 text-sm text-white/58">
                        <p>PUSD payments are highlighted as the fastest way to build your reward balance.</p>
                        <p>Each eligible booking adds 40 points, so repeat sessions turn into a visible loyalty score quickly.</p>
                        <p>More perks can plug into this same rewards rail later without changing the profile flow.</p>
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
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">Booking credits</p>
                      <p className="mt-4 text-4xl font-semibold text-white">
                        {loadingBalances && !balances ? "..." : `$${formatUsdAmount(balances?.bookingCreditsUsd ?? 0)}`}
                      </p>
                      <p className="mt-2 text-sm text-white/48">
                        Card top-ups from Dodo land here and can power future booking flows.
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] bg-[#101010] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">USDC balance</p>
                      <p className="mt-4 text-4xl font-semibold text-white">
                        {loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.usdc ?? 0, 2)} USDC`}
                      </p>
                      <p className="mt-2 text-sm text-white/48">
                        Uses the configured USDC mint for {balances?.network === "devnet" ? "devnet" : "mainnet"}.
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] bg-[#101010] p-5">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">PUSD balance</p>
                      <p className="mt-4 text-4xl font-semibold text-white">
                        {loadingBalances && !balances ? "..." : `${formatTokenAmount(balances?.pusd ?? 0, 2)} PUSD`}
                      </p>
                      <p className="mt-2 text-sm text-white/48">
                        Your PUSD token account is prepared automatically when needed.
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
                title="Top up booking credits"
                onClose={() => setDepositModalOpen(false)}
                size="wide"
              >
                <div className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-3">
                    {DODO_TOPUP_PACKS.map((pack) => {
                      const isLoadingPack = topupLoadingPackId === pack.id;
                      return (
                        <div
                          key={pack.id}
                          className="flex min-h-48 flex-col rounded-[1.25rem] border border-white/10 bg-[#111111] p-4"
                        >
                          <div className="min-w-0">
                            <p className="text-xl font-semibold text-white">{pack.label}</p>
                            <p className="mt-2 min-h-10 text-sm leading-5 text-white/56">{pack.caption}</p>
                          </div>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className="rounded-full bg-white/7 px-3 py-1.5 text-sm font-semibold text-white/80">
                              +${pack.creditsUsd.toFixed(2)} credits
                            </span>
                            <span className="rounded-full bg-white/7 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-white/44">
                              Local checkout
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => void startTopup(pack)}
                            disabled={Boolean(topupLoadingPackId)}
                            className="mt-auto inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#ffd28e] px-5 py-2.5 text-center text-sm font-semibold text-black transition-colors hover:bg-[#ffc97a] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]"
                          >
                            {isLoadingPack ? "Opening..." : (
                              <span className="leading-5">
                                Top up<br />
                                ${pack.creditsUsd.toFixed(2)}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {topupProcessingMessage ? (
                    <div className="rounded-[1.25rem] border border-[#94f0c0]/18 bg-[#0f1713] px-4 py-3 text-sm text-[#d4ffe6]">
                      {topupProcessingMessage}
                    </div>
                  ) : null}
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

          </>
        )}
      </main>
    </div>
  );
}

function DetailPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-[1.1rem] border border-white/10 bg-black/20 px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/38">{label}</p>
      <p className="mt-1 text-sm font-medium text-white/82">{value}</p>
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
  size = "default",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  size?: "default" | "wide";
}) {
  const widthClass = size === "wide" ? "max-w-5xl" : "max-w-xl";

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`max-h-[min(90vh,760px)] w-full ${widthClass} overflow-y-auto rounded-[1.75rem] bg-[#0f0f0f] p-5 shadow-2xl sm:p-6`} onClick={(e) => e.stopPropagation()}>
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
