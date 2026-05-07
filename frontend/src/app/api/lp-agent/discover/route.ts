import { NextResponse } from "next/server";
import { LpAgentRequestError, lpAgentRequest } from "@/lib/lp-agent";

type DiscoverResponse = {
  data?: unknown[];
  count?: number;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const params = new URLSearchParams({
      chain: searchParams.get("chain") ?? "SOL",
      sortBy: searchParams.get("sortBy") ?? "tvl",
      sortOrder: searchParams.get("sortOrder") ?? "desc",
      pageSize: searchParams.get("pageSize") ?? "12",
      min_market_cap: searchParams.get("min_market_cap") ?? "1000000",
      min_liquidity: searchParams.get("min_liquidity") ?? "100000",
    });

    const data = await lpAgentRequest<DiscoverResponse>(
      "GET",
      `/pools/discover?${params.toString()}`
    );

    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to discover pools";
    const status = error instanceof LpAgentRequestError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
