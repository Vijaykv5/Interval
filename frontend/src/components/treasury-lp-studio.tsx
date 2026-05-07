"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useSignTransaction, useWallets } from "@privy-io/react-auth/solana";
import { toast } from "sonner";
import { SOLANA_WALLET_CHAIN } from "@/lib/solana-config";

type EarningsByCurrency = {
  SOL: number;
  PUSD: number;
};

type TreasuryLpStudioProps = {
  walletAddress: string | null;
  earningsByCurrency: EarningsByCurrency;
  totalBookings: number;
};

type PoolRecommendation = {
  pool: string;
  protocol?: string | null;
  token0_symbol?: string | null;
  token1_symbol?: string | null;
  vol_24h?: number | null;
  tvl?: number | null;
  apr?: number | null;
  apy?: number | null;
  mcap?: number | null;
};

type PoolFilter = "all" | "dlmm" | "damm";

type Position = {
  id: string;
  pairName?: string | null;
  currentValue?: number | null;
  inRange?: boolean | null;
  fees?: {
    total?: number | null;
    collected?: number | null;
    uncollected?: number | null;
  } | null;
  pnl?: {
    percent?: number | null;
    value?: number | null;
  } | null;
  prices?: {
    token0?: number | null;
    token1?: number | null;
  } | null;
  apr?: number | null;
  currentAmounts?: {
    token0?: number | null;
    token1?: number | null;
  } | null;
};

type QuoteResponse = {
  price?: {
    token0?: number | null;
    token1?: number | null;
  };
  hasQuote?: boolean;
};

type PreparedZapInResponse = {
  lastValidBlockHeight?: number;
  swapTxsWithJito?: string[];
  addLiquidityTxsWithJito?: string[];
  meta?: Record<string, unknown> | null;
};

type LandedZapInResponse = {
  signature?: string | null;
  signatures?: string[] | null;
};

type PreparedZapOutResponse = {
  lastValidBlockHeight?: number;
  closeTxsWithJito?: string[];
  swapTxsWithJito?: string[];
  bps?: number;
  output?: string;
};

type LandedZapOutResponse = {
  signature?: string | null;
};

function formatUsd(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return `${value.toFixed(2)}%`;
}

function formatYieldSummary(pool: PoolRecommendation) {
  const apr = formatPercent(pool.apr);
  const apy = formatPercent(pool.apy);

  if (apr !== "—" && apy !== "—") return `${apr} / ${apy}`;
  if (apr !== "—") return `${apr} APR`;
  if (apy !== "—") return `${apy} APY`;
  return "No APR data";
}

function formatDlmmDescriptor(pool: PoolRecommendation) {
  const tvl = pool.tvl ?? 0;
  if (tvl >= 1_000_000) return "Deep liquidity";
  if (tvl >= 250_000) return "Healthy liquidity";
  return "Active bins";
}

function formatTokenAmount(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: value >= 1000 ? 0 : 4,
  }).format(value);
}

function poolPairLabel(pool: PoolRecommendation) {
  const token0 = pool.token0_symbol?.trim() || "Token A";
  const token1 = pool.token1_symbol?.trim() || "Token B";
  return `${token0}/${token1}`;
}

function RefreshIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

function ChevronIcon({
  open,
  className = "h-4 w-4",
}: {
  open: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`${className} transition-transform ${open ? "rotate-180" : ""}`}
      aria-hidden="true"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function isPreferredDlmmPool(pool: PoolRecommendation) {
  if (pool.protocol !== "meteora") return false;
  const tvl = pool.tvl ?? 0;
  if (tvl < 100_000) return false;

  const token0 = pool.token0_symbol?.toUpperCase() ?? "";
  const token1 = pool.token1_symbol?.toUpperCase() ?? "";
  const pair = [token0, token1];

  const hasSol = pair.includes("SOL");
  const hasTrustedQuote = pair.some((symbol) =>
    ["USDC", "USDT", "JUP", "JLP", "BONK", "PYTH", "ETH", "BTC"].includes(symbol)
  );

  return hasSol && hasTrustedQuote;
}

function isZapReadyPool(pool: PoolRecommendation) {
  return pool.protocol === "meteora" || pool.protocol === "meteora_damm_v2";
}

function getPoolType(pool: PoolRecommendation): Exclude<PoolFilter, "all"> | "other" {
  if (pool.protocol === "meteora") return "dlmm";
  if (pool.protocol === "meteora_damm_v2") return "damm";
  return "other";
}

function sortPools(pools: PoolRecommendation[]) {
  return [...pools].sort((a, b) => {
    const preferredDelta = Number(isPreferredDlmmPool(b)) - Number(isPreferredDlmmPool(a));
    if (preferredDelta !== 0) return preferredDelta;

    const aprA = a.apr ?? a.apy ?? -1;
    const aprB = b.apr ?? b.apy ?? -1;
    if (aprB !== aprA) return aprB - aprA;

    return (b.tvl ?? 0) - (a.tvl ?? 0);
  });
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center justify-center rounded-xl border px-4 text-sm font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305] ${
        active
          ? "border-[#ffd28e]/35 bg-[#ffd28e]/15 text-[#ffd28e]"
          : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
      }`}
    >
      {label}
    </button>
  );
}

export function TreasuryLpStudio({
  walletAddress,
  earningsByCurrency: _earningsByCurrency,
  totalBookings: _totalBookings,
}: TreasuryLpStudioProps) {
  const { authenticated } = usePrivy();
  const { wallets } = useWallets();
  const { signTransaction } = useSignTransaction();
  const [recommendations, setRecommendations] = useState<PoolRecommendation[]>([]);
  const [recommendationsLoading, setRecommendationsLoading] = useState(false);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("all");
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [zapAmounts, setZapAmounts] = useState<Record<string, string>>({});
  const [zapInBusyPool, setZapInBusyPool] = useState<string | null>(null);
  const [zapInStage, setZapInStage] = useState<string | null>(null);
  const [zapOutBusyPosition, setZapOutBusyPosition] = useState<string | null>(null);
  const [quoteBusyPosition, setQuoteBusyPosition] = useState<string | null>(null);
  const [quotes, setQuotes] = useState<Record<string, QuoteResponse>>({});
  const [lastZapSignature, setLastZapSignature] = useState<string | null>(null);
  const [positionSyncMessage, setPositionSyncMessage] = useState<string | null>(null);
  const [positionsOpen, setPositionsOpen] = useState(true);
  const solanaWallet = wallets[0];

  function bytesToBase64(bytes: Uint8Array) {
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  function base64ToBytes(base64: string) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  async function fetchJsonWithTimeout(
    input: string,
    init: RequestInit,
    timeoutMs: number,
    timeoutMessage: string
  ) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(input, {
        ...init,
        signal: controller.signal,
      });
      const rawText = await res.text();
      let data: Record<string, unknown> = {};
      try {
        data = rawText ? (JSON.parse(rawText) as Record<string, unknown>) : {};
      } catch {
        data = rawText ? { raw: rawText } : {};
      }
      if (!res.ok) {
        const detail =
          typeof data?.error === "string"
            ? data.error
            : typeof data?.message === "string"
              ? data.message
              : typeof data?.raw === "string"
                ? data.raw
                : `Request failed with status code ${res.status}`;
        const landingDetail =
          typeof data?.detail === "string" ? data.detail : null;
        throw new Error(
          landingDetail ? `${detail} ${landingDetail}` : detail
        );
      }
      return data;
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(timeoutMessage);
      }
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async function signBase64TransactionWithRetry(transaction: string) {
    if (!solanaWallet || !walletAddress) {
      throw new Error("Connect your wallet before signing treasury transactions.");
    }

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await signTransaction({
          transaction: base64ToBytes(transaction),
          wallet: solanaWallet,
          chain: SOLANA_WALLET_CHAIN,
        });
        return bytesToBase64(result.signedTransaction);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const isTimeout =
          message.includes("HeadersTimeoutError") ||
          message.includes("Headers Timeout Error") ||
          message.includes("failed to get recent blockhash");

        if (!isTimeout || attempt === 1) {
          throw new Error(
            isTimeout
              ? "Wallet RPC timed out while preparing the transaction. Please try again, or switch NEXT_PUBLIC_SOLANA_RPC to a faster browser-safe Solana RPC."
              : message
          );
        }

        await new Promise((resolve) => setTimeout(resolve, 750));
      }
    }

    throw new Error("Failed to sign treasury transaction.");
  }

  async function signBase64Transactions(transactions: string[]) {
    if (!solanaWallet || !walletAddress) {
      throw new Error("Connect your wallet before signing treasury transactions.");
    }

    const signed: string[] = [];
    for (const tx of transactions) {
      signed.push(await signBase64TransactionWithRetry(tx));
    }
    return signed;
  }

  async function fetchRecommendations() {
    setRecommendationsLoading(true);
    setRecommendationsError(null);
    try {
      const res = await fetch("/api/lp-agent/discover");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to load recommendations");
      const pools = Array.isArray(data?.data) ? (data.data as PoolRecommendation[]) : [];
      setRecommendations(sortPools(pools));
    } catch (error) {
      setRecommendationsError(error instanceof Error ? error.message : "Failed to load recommendations");
    } finally {
      setRecommendationsLoading(false);
    }
  }

  async function fetchPositions(options?: { silent?: boolean }) {
    if (!walletAddress) {
      setPositions([]);
      return [];
    }

    if (!options?.silent) {
      setPositionsLoading(true);
      setPositionsError(null);
    }
    try {
      const res = await fetch(`/api/lp-agent/positions?owner=${encodeURIComponent(walletAddress)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "Failed to load positions");
      const nextPositions = Array.isArray(data?.data) ? (data.data as Position[]) : [];
      setPositions(nextPositions);
      return nextPositions;
    } catch (error) {
      setPositionsError(error instanceof Error ? error.message : "Failed to load positions");
      return [];
    } finally {
      if (!options?.silent) {
        setPositionsLoading(false);
      }
    }
  }

  async function waitForFreshPosition(previousPositions: Position[]) {
    const previousIds = new Set(previousPositions.map((position) => position.id));
    setPositionSyncMessage("Refreshing LP positions. New positions can take a few seconds to appear.");

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 4000));
      const latestPositions = await fetchPositions({ silent: true });
      const hasNewPosition =
        latestPositions.length > previousPositions.length ||
        latestPositions.some((position) => !previousIds.has(position.id));

      if (hasNewPosition) {
        setPositionSyncMessage("Your new LP position is now visible below.");
        return true;
      }

      if (attempt < 6) {
        setPositionSyncMessage(
          `Waiting for LP Agent to index the new position (${attempt}/6)…`
        );
      }
    }

    setPositionSyncMessage(
      "The zap-in landed on-chain, but LP Agent has not indexed the position yet. Use the transaction link below and refresh again shortly."
    );
    return false;
  }

  useEffect(() => {
    fetchRecommendations();
  }, []);

  useEffect(() => {
    fetchPositions();
  }, [walletAddress]);

  useEffect(() => {
    function syncOpenStateFromHash() {
      if (window.location.hash === "#open-lp-positions") {
        setPositionsOpen(true);
      }
    }

    syncOpenStateFromHash();
    window.addEventListener("hashchange", syncOpenStateFromHash);
    return () => window.removeEventListener("hashchange", syncOpenStateFromHash);
  }, []);

  async function handleZapIn(pool: PoolRecommendation) {
    if (!walletAddress || !solanaWallet) {
      toast.error("Connect your wallet before zapping into a pool.");
      return;
    }
    if (!isZapReadyPool(pool)) {
      toast.error("This recommendation is not zap-ready in the current UI yet. Pick a pool marked Zap ready.");
      return;
    }

    const inputRaw = zapAmounts[pool.pool] ?? "";
    const inputSOL = Number.parseFloat(inputRaw);
    if (!Number.isFinite(inputSOL) || inputSOL <= 0) {
      toast.error("Enter a valid SOL amount before zapping in.");
      return;
    }
    if (inputSOL < 0.001) {
      toast.error("Use at least 0.001 SOL for zap-in.");
      return;
    }

    setLastZapSignature(null);
    setPositionSyncMessage(null);
    setZapInBusyPool(pool.pool);
    setZapInStage("Preparing pool transactions…");
    const previousPositions = positions;

    try {
      const prepareData = (await fetchJsonWithTimeout(
        "/api/lp-agent/zap-in",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          poolId: pool.pool,
          poolProtocol: pool.protocol,
          inputSOL,
        }),
        },
        90_000,
        "Preparing the zap-in took too long. Please try again."
      )) as PreparedZapInResponse;

      const swapTxs = prepareData?.swapTxsWithJito ?? [];
      const addTxs = prepareData?.addLiquidityTxsWithJito ?? [];
      const totalTransactionsToSign = swapTxs.length + addTxs.length;

      if (totalTransactionsToSign === 0) {
        throw new Error(
          "LP Agent did not return any zap-in transactions to sign. Nothing was sent to your wallet for approval."
        );
      }

      let signedSwapTxs: string[] = [];
      let signedAddTxs: string[] = [];

      if (swapTxs.length > 0) {
        setZapInStage(
          swapTxs.length === 1
            ? "Approve the swap transaction in Privy…"
            : `Approve ${swapTxs.length} swap transactions in Privy…`
        );
        signedSwapTxs = await signBase64Transactions(swapTxs);
      }

      if (addTxs.length > 0) {
        setZapInStage(
          addTxs.length === 1
            ? "Approve the add-liquidity transaction in Privy…"
            : `Approve ${addTxs.length} add-liquidity transactions in Privy…`
        );
        signedAddTxs = await signBase64Transactions(addTxs);
      }

      setZapInStage("Landing signed transactions…");
      const data = (await fetchJsonWithTimeout(
        "/api/lp-agent/zap-in",
        {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          poolId: pool.pool,
          poolProtocol: pool.protocol,
          inputSOL,
          lastValidBlockHeight: prepareData?.lastValidBlockHeight,
          signedSwapTxs,
          signedAddTxs,
          meta: prepareData?.meta,
        }),
        },
        90_000,
        "Landing the zap-in took too long. LP Agent may still be processing the signed transactions. Check Solscan before retrying."
      )) as LandedZapInResponse;

      const primarySignature = data?.signature ?? data?.signatures?.at(-1) ?? null;
      setLastZapSignature(primarySignature);
      toast.success("Signed transactions submitted.", {
        description: primarySignature
          ? `Signature ${primarySignature.slice(0, 8)}...`
          : "LP Agent accepted the signed zap-in payload.",
      });
      const positionVisible = await waitForFreshPosition(previousPositions);
      if (positionVisible) {
        toast.success("Zap-in complete.", {
          description: primarySignature
            ? `Signature ${primarySignature.slice(0, 8)}...`
            : "The LP position is now visible.",
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zap-in failed");
    } finally {
      setZapInBusyPool(null);
      setZapInStage(null);
    }
  }

  const dlmmPools = recommendations.filter((pool) => getPoolType(pool) === "dlmm");
  const dammPools = recommendations.filter((pool) => getPoolType(pool) === "damm");
  const otherPools = recommendations.filter((pool) => getPoolType(pool) === "other");

  function renderPoolCard(pool: PoolRecommendation) {
    const poolType = getPoolType(pool);
    const showYield = poolType !== "dlmm";

    return (
      <article
        key={pool.pool}
        className="rounded-2xl border border-white/10 bg-black/20 p-5 transition-colors hover:border-white/15"
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-lg font-semibold text-white">{poolPairLabel(pool)}</h4>
            <span className="rounded-full border border-[#ffd28e]/25 bg-[#ffd28e]/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#ffd28e]">
              {(pool.protocol ?? "Meteora").replaceAll("_", " ")}
            </span>
            <span className="rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">
              {poolType === "dlmm" ? "DLMM" : poolType === "damm" ? "DAMM" : "Other"}
            </span>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                isZapReadyPool(pool)
                  ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                  : "border border-white/15 bg-white/5 text-white/65"
              }`}
            >
              {isZapReadyPool(pool) ? "Zap ready" : "View only"}
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-white/60">
            <div>
              <p className="text-white/40">24h volume</p>
              <p className="mt-1 font-medium text-white">{formatUsd(pool.vol_24h)}</p>
            </div>
            <div>
              <p className="text-white/40">TVL</p>
              <p className="mt-1 font-medium text-white">{formatUsd(pool.tvl)}</p>
            </div>
            <div>
              <p className="text-white/40">{showYield ? "APR / APY" : "DLMM profile"}</p>
              <p className="mt-1 font-medium text-white">
                {showYield ? formatYieldSummary(pool) : formatDlmmDescriptor(pool)}
              </p>
            </div>
          </div>
          {!showYield && (
            <p className="mt-2 text-xs text-white/35">
              Concentrated-liquidity pool with active-bin execution. Focus on depth and routing instead of headline yield.
            </p>
          )}
          {showYield && pool.apr == null && pool.apy == null ? (
            <p className="mt-2 text-xs text-white/35">
              APR data is missing from discovery for this pool, so the app is trying LP Agent pool info as a fallback.
            </p>
          ) : null}
          <p className="mt-4 font-mono text-xs text-white/35 break-all">{pool.pool}</p>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <label
            htmlFor={`zap-amount-${pool.pool}`}
            className="block text-sm font-medium text-white/85"
          >
            {isZapReadyPool(pool) ? "Zap in with SOL" : "Pool status"}
          </label>
          {isZapReadyPool(pool) ? (
            <div className="mt-2 flex gap-2">
              <input
                id={`zap-amount-${pool.pool}`}
                type="number"
                min="0"
                step="0.01"
                value={zapAmounts[pool.pool] ?? ""}
                onChange={(event) =>
                  setZapAmounts((current) => ({
                    ...current,
                    [pool.pool]: event.target.value,
                  }))
                }
                placeholder="0.10"
                className="min-h-10 flex-1 rounded-xl border border-white/20 bg-black/40 px-3.5 text-white placeholder:text-white/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/40"
              />
              <button
                type="button"
                onClick={() => handleZapIn(pool)}
                disabled={!authenticated || zapInBusyPool === pool.pool}
                className="min-h-10 rounded-xl px-4 text-sm font-semibold text-black transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
                style={{ backgroundColor: "#ffd28e" }}
              >
                {zapInBusyPool === pool.pool ? "Working…" : "Zap in"}
              </button>
            </div>
          ) : (
            <div className="mt-2 rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm text-white/60">
              This pool can be explored here, but zap-in is not enabled for it in this UI yet.
            </div>
          )}
          <p className="mt-2 text-xs leading-5 text-white/45">
            {isZapReadyPool(pool)
              ? "LP Agent will prepare the add transactions, you will sign locally, and the app will land them through Jito."
              : "Use this as a discovery card for now while zap support stays focused on supported Meteora pools."}
          </p>
          {zapInBusyPool === pool.pool && zapInStage && (
            <p className="mt-2 text-xs font-medium text-[#ffd28e]">
              {zapInStage}
            </p>
          )}
        </div>
      </article>
    );
  }

  function renderPoolSection(title: string, pools: PoolRecommendation[], description: string) {
    if (pools.length === 0) return null;

    return (
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/75">{title}</h4>
            <p className="mt-1 text-sm text-white/45">{description}</p>
          </div>
          <p className="text-xs uppercase tracking-[0.16em] text-white/35">
            {pools.length} pool{pools.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {pools.map((pool) => renderPoolCard(pool))}
        </div>
      </section>
    );
  }

  function renderPositionsContent() {
    if (positionsLoading) {
      return (
        <div className="space-y-3">
          {[1, 2].map((item) => (
            <div key={item} className="h-36 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      );
    }

    if (positionsError) {
      return (
        <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">
          <p>{positionsError}</p>
          <button
            type="button"
            onClick={() => {
              void fetchPositions();
            }}
            className="mt-3 min-h-10 rounded-lg border border-red-300/25 px-3 text-sm font-medium text-red-100 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/40"
          >
            Try again
          </button>
        </div>
      );
    }

    if (positions.length === 0) {
      return (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
          <p className="text-white/75">No open LP positions yet.</p>
          <p className="mt-2 text-sm text-white/50">
            Use the recommendations below to deploy part of your treasury into a Meteora pool.
          </p>
          {positionSyncMessage ? (
            <p className="mt-3 text-sm text-[#ffd28e]">{positionSyncMessage}</p>
          ) : null}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {positions.map((position) => {
          const quote = quotes[position.id];

          return (
            <article
              key={position.id}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 transition-colors hover:border-white/15"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-lg font-semibold text-white">
                      {position.pairName?.trim() || "LP position"}
                    </h4>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                        position.inRange
                          ? "border border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
                          : "border border-amber-400/25 bg-amber-500/10 text-amber-200"
                      }`}
                    >
                      {position.inRange ? "In range" : "Out of range"}
                    </span>
                  </div>

                  <div className="mt-3 grid gap-3 text-sm text-white/60 sm:grid-cols-3">
                    <div>
                      <p className="text-white/40">Current value</p>
                      <p className="mt-1 font-medium text-white">{formatUsd(position.currentValue)}</p>
                    </div>
                    <div>
                      <p className="text-white/40">PnL</p>
                      <p className="mt-1 font-medium text-white">{formatPercent(position.pnl?.percent)}</p>
                    </div>
                    <div>
                      <p className="text-white/40">Fees earned</p>
                      <p className="mt-1 font-medium text-white">{formatUsd(position.fees?.total)}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-white/60 sm:grid-cols-3">
                    <div>
                      <p className="text-white/40">Current token prices</p>
                      <p className="mt-1 font-medium text-white">
                        {formatUsd(position.prices?.token0)} / {formatUsd(position.prices?.token1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">Current token amounts</p>
                      <p className="mt-1 font-medium text-white">
                        {formatTokenAmount(position.currentAmounts?.token0)} / {formatTokenAmount(position.currentAmounts?.token1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40">APR</p>
                      <p className="mt-1 font-medium text-white">{formatPercent(position.apr)}</p>
                    </div>
                  </div>

                  {(typeof position.fees?.collected === "number" || typeof position.fees?.uncollected === "number") && (
                    <p className="mt-3 text-xs text-white/45">
                      Collected: {formatUsd(position.fees?.collected)}. Uncollected: {formatUsd(position.fees?.uncollected)}.
                    </p>
                  )}

                  {quote && (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/60">
                      <p className="font-medium text-white">Zap-out quote</p>
                      {quote.hasQuote ? (
                        <p className="mt-2">
                          Token prices: {formatUsd(quote.price?.token0)} / {formatUsd(quote.price?.token1)}
                        </p>
                      ) : (
                        <p className="mt-2 text-white/45">
                          No zap-out quote is available for this position right now.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex w-full max-w-sm flex-col gap-2 xl:items-end">
                  <button
                    type="button"
                    onClick={() => handleQuote(position.id)}
                    disabled={quoteBusyPosition === position.id}
                    className="min-h-10 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/85 transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
                  >
                    {quoteBusyPosition === position.id ? "Loading quote…" : "Preview zap-out"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZapOut(position.id)}
                    disabled={!authenticated || zapOutBusyPosition === position.id}
                    className="min-h-10 w-full rounded-xl px-4 text-sm font-semibold text-black transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
                    style={{ backgroundColor: "#ffd28e" }}
                  >
                    {zapOutBusyPosition === position.id ? "Zapping out…" : "Zap out to SOL"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  async function handleQuote(positionId: string) {
    setQuoteBusyPosition(positionId);
    try {
      const res = await fetch("/api/lp-agent/zap-out/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: positionId, bps: 10000 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error ?? "Failed to load zap-out quote");
      }
      const quotePayload = (data?.data ?? {}) as QuoteResponse;
      const token0 = quotePayload?.price?.token0;
      const token1 = quotePayload?.price?.token1;
      setQuotes((current) => ({
        ...current,
        [positionId]: {
          ...quotePayload,
          hasQuote:
            typeof token0 === "number" ||
            typeof token1 === "number",
        },
      }));
      if (!(typeof token0 === "number" || typeof token1 === "number")) {
        toast.error("No zap-out quote is available for this position right now.");
      } else {
        toast.success("Zap-out quote loaded.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Quote request failed");
    } finally {
      setQuoteBusyPosition(null);
    }
  }

  async function handleZapOut(positionId: string) {
    if (!walletAddress || !solanaWallet) {
      toast.error("Connect your wallet before zapping out.");
      return;
    }

    setZapOutBusyPosition(positionId);

    try {
      const prepareData = (await fetchJsonWithTimeout(
        "/api/lp-agent/zap-out",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: walletAddress,
            positionId,
            bps: 10000,
            output: "allBaseToken",
          }),
        },
        90_000,
        "Preparing the zap-out took too long. Please try again."
      )) as PreparedZapOutResponse;

      const closeTxs = prepareData?.closeTxsWithJito ?? [];
      const swapTxs = prepareData?.swapTxsWithJito ?? [];

      if (closeTxs.length > 0) {
        toast.success(
          closeTxs.length === 1
            ? "Approve the close-position transaction in Privy…"
            : `Approve ${closeTxs.length} close-position transactions in Privy…`
        );
      }
      const signedCloseTxs = await signBase64Transactions(closeTxs);

      if (swapTxs.length > 0) {
        toast.success(
          swapTxs.length === 1
            ? "Approve the swap-to-SOL transaction in Privy…"
            : `Approve ${swapTxs.length} swap-to-SOL transactions in Privy…`
        );
      }
      const signedSwapTxs = await signBase64Transactions(swapTxs);

      const data = (await fetchJsonWithTimeout(
        "/api/lp-agent/zap-out",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            wallet: walletAddress,
            positionId,
            bps: 10000,
            output: "allBaseToken",
            lastValidBlockHeight: prepareData?.lastValidBlockHeight,
            signedCloseTxs,
            signedSwapTxs,
          }),
        },
        90_000,
        "Landing the zap-out took too long. Please try again."
      )) as LandedZapOutResponse;

      toast.success("Zap-out landed.", {
        description: data?.signature
          ? `Signature ${data.signature.slice(0, 8)}...`
          : "The LP Agent exit transaction was submitted.",
      });
      await fetchPositions();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Zap-out failed");
    } finally {
      setZapOutBusyPosition(null);
    }
  }

  return (
    <div className="space-y-8">
      <section
        id="open-lp-positions"
        className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm overflow-hidden scroll-mt-24"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h3 className="text-base font-semibold text-white">Open LP positions</h3>
            <p className="mt-1 text-sm text-white/50">
              Track portfolio state, preview exit quotes, and zap out when you want to rotate capital.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/65">
              {positions.length} open
            </span>
            <button
              type="button"
              onClick={() => {
                void fetchPositions();
              }}
              aria-label="Refresh LP positions"
              title="Refresh LP positions"
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
            >
              <RefreshIcon />
            </button>
            <button
              type="button"
              onClick={() => setPositionsOpen((current) => !current)}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
            >
              <span>{positionsOpen ? "Hide" : "Show"}</span>
              <ChevronIcon open={positionsOpen} />
            </button>
          </div>
        </div>

        {positionsOpen ? <div className="p-5">{renderPositionsContent()}</div> : null}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-5">
          <div>
            <h3 className="text-base font-semibold text-white">LP pool recommendations</h3>
            <p className="mt-1 text-sm text-white/50">
              Discover Meteora pools and move idle creator capital into LP with one click.
            </p>
          </div>
          <button
            type="button"
            onClick={fetchRecommendations}
            aria-label="Refresh LP pool recommendations"
            title="Refresh LP pool recommendations"
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-3 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
          >
            <RefreshIcon />
          </button>
        </div>

        <div className="p-5">
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <FilterButton active={poolFilter === "all"} label="All" onClick={() => setPoolFilter("all")} />
            <FilterButton active={poolFilter === "dlmm"} label="DLMM" onClick={() => setPoolFilter("dlmm")} />
            <FilterButton active={poolFilter === "damm"} label="DAMM" onClick={() => setPoolFilter("damm")} />
          </div>

          {positionSyncMessage || lastZapSignature ? (
            <div className="mb-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4 text-sm text-emerald-200">
              {positionSyncMessage ? (
                <p>{positionSyncMessage}</p>
              ) : (
                <p>Transaction submitted.</p>
              )}
              {lastZapSignature ? (
                <a
                  href={`https://solscan.io/tx/${lastZapSignature}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex text-sm font-medium text-emerald-100 underline underline-offset-4 hover:text-white"
                >
                  View transaction on Solscan
                </a>
              ) : null}
            </div>
          ) : null}

          {recommendationsLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((item) => (
                <div key={item} className="h-72 rounded-2xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : recommendationsError ? (
            <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-200">
              <p>{recommendationsError}</p>
              <button
                type="button"
                onClick={fetchRecommendations}
                className="mt-3 min-h-10 rounded-lg border border-red-300/25 px-3 text-sm font-medium text-red-100 hover:bg-red-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-200/40"
              >
                Try again
              </button>
            </div>
          ) : recommendations.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-sm text-white/55">
              No pool recommendations are available right now. Refresh to try again.
            </div>
          ) : poolFilter === "dlmm" ? (
            renderPoolSection(
              "DLMM Pools",
              dlmmPools,
              "Concentrated-liquidity Meteora pools with active-bin routing and the strongest default fit for the current zap flow."
            )
          ) : poolFilter === "damm" ? (
            renderPoolSection(
              "DAMM Pools",
              dammPools,
              "Dynamic AMM Meteora pools surfaced separately so you can compare them directly against DLMM options."
            )
          ) : (
            <div className="space-y-8">
              {renderPoolSection(
                "DLMM Pools",
                dlmmPools,
                "Concentrated-liquidity Meteora pools prioritized for active-bin routing and stronger treasury deployment defaults."
              )}
              {renderPoolSection(
                "DAMM Pools",
                dammPools,
                "Dynamic AMM Meteora pools, separated so you can compare their volume, TVL, and yield profile directly."
              )}
              {renderPoolSection(
                "Other Discoveries",
                otherPools,
                "Additional pools returned by LP Agent that are visible for research but not first-class in the current zap flow."
              )}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
