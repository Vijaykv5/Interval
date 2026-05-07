import { NextResponse } from "next/server";
import { LpAgentRequestError, lpAgentRequest } from "@/lib/lp-agent";

type PositionsResponse = {
  count?: number;
  data?: unknown[];
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  return null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizePosition(raw: unknown) {
  const position = asRecord(raw);
  if (!position) return null;

  const pnl = asRecord(position.pnl);
  const token0Info = asRecord(position.token0Info);
  const token1Info = asRecord(position.token1Info);

  const token0Symbol =
    asString(token0Info?.token_symbol) ||
    asString(position.tokenName0) ||
    asString(position.token0_symbol);
  const token1Symbol =
    asString(token1Info?.token_symbol) ||
    asString(position.tokenName1) ||
    asString(position.token1_symbol);

  const pairName =
    asString(position.pairName) ||
    (token0Symbol && token1Symbol ? `${token0Symbol}/${token1Symbol}` : token0Symbol || token1Symbol || "LP position");

  const collectedFee = asNumber(position.collectedFee) ?? 0;
  const unCollectedFee =
    asNumber(position.unCollectedFee) ??
    asNumber(position.uncollectedFee) ??
    0;

  return {
    id: asString(position.id) || asString(position.position) || asString(position.tokenId) || "",
    pairName,
    currentValue: asNumber(position.currentValue) ?? asNumber(position.value),
    inRange: asBoolean(position.inRange),
    fees: {
      total: collectedFee + unCollectedFee,
      collected: collectedFee,
      uncollected: unCollectedFee,
    },
    pnl: {
      percent: asNumber(pnl?.percent),
      value: asNumber(pnl?.value),
    },
    prices: {
      token0: asNumber(position.price0),
      token1: asNumber(position.price1),
    },
    apr: asNumber(position.apr),
    currentAmounts: {
      token0: asNumber(asRecord(position.current)?.amount0Adjusted),
      token1: asNumber(asRecord(position.current)?.amount1Adjusted),
    },
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const owner = searchParams.get("owner")?.trim();

    if (!owner) {
      return NextResponse.json({ error: "owner is required" }, { status: 400 });
    }

    const data = await lpAgentRequest<PositionsResponse>(
      "GET",
      `/lp-positions/opening?owner=${encodeURIComponent(owner)}`
    );

    return NextResponse.json({
      ...data,
      data: Array.isArray(data.data)
        ? data.data.map(normalizePosition).filter(Boolean)
        : [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load positions";
    const status = error instanceof LpAgentRequestError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
