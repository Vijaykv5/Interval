import { NextResponse } from "next/server";
import { LpAgentRequestError, lpAgentRequest } from "@/lib/lp-agent";

type DiscoverResponse = {
  data?: unknown[];
  count?: number;
};

type PoolInfoResponse = {
  data?: Record<string, unknown>;
};

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function extractYieldMetric(
  value: unknown,
  keys: string[],
  depth = 0
): number | null {
  if (!value || typeof value !== "object" || depth > 4) return null;

  const record = value as Record<string, unknown>;

  for (const key of keys) {
    const direct = asNumber(record[key]);
    if (direct != null) return direct;
  }

  for (const nested of Object.values(record)) {
    const match = extractYieldMetric(nested, keys, depth + 1);
    if (match != null) return match;
  }

  return null;
}

async function enrichPool(pool: unknown) {
  if (!pool || typeof pool !== "object") return pool;

  const record = pool as Record<string, unknown>;
  const poolId = typeof record.pool === "string" ? record.pool : null;
  const hasApr = asNumber(record.apr) != null;
  const hasApy = asNumber(record.apy) != null;

  if (!poolId || (hasApr && hasApy)) {
    return pool;
  }

  try {
    const info = await lpAgentRequest<PoolInfoResponse>(
      "GET",
      `/pools/${encodeURIComponent(poolId)}/info`
    );
    const infoData = info.data ?? {};

    const apr =
      asNumber(record.apr) ??
      extractYieldMetric(infoData, [
        "apr",
        "feeApr",
        "totalApr",
        "baseApr",
        "rewardApr",
      ]);
    const apy =
      asNumber(record.apy) ??
      extractYieldMetric(infoData, [
        "apy",
        "feeApy",
        "totalApy",
        "baseApy",
        "rewardApy",
      ]);
    const protocol =
      typeof record.protocol === "string" && record.protocol.trim().length > 0
        ? record.protocol
        : typeof infoData.type === "string"
          ? infoData.type
          : record.protocol;

    return {
      ...record,
      protocol,
      apr,
      apy,
    };
  } catch {
    return pool;
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams({
      chain: searchParams.get("chain") ?? "SOL",
      sortBy: searchParams.get("sortBy") ?? "tvl",
      sortOrder: searchParams.get("sortOrder") ?? "desc",
      pageSize: searchParams.get("pageSize") ?? "24",
      min_market_cap: searchParams.get("min_market_cap") ?? "1000000",
      min_liquidity: searchParams.get("min_liquidity") ?? "100000",
    });

    const data = await lpAgentRequest<DiscoverResponse>(
      "GET",
      `/pools/discover?${params.toString()}`
    );

    const pools = Array.isArray(data.data) ? data.data : [];
    const enrichedPools = await Promise.all(pools.map((pool) => enrichPool(pool)));

    return NextResponse.json({
      ...data,
      data: enrichedPools,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to discover pools";
    const status = error instanceof LpAgentRequestError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
