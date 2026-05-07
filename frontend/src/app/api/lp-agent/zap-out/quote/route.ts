import { NextResponse } from "next/server";
import { lpAgentRequest } from "@/lib/lp-agent";

type QuoteBody = {
  id?: string;
  bps?: number;
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

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QuoteBody;
    const id = body.id?.trim();
    const bps = typeof body.bps === "number" ? body.bps : 10000;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const data = await lpAgentRequest<Record<string, unknown>>(
      "POST",
      "/position/decrease-quotes",
      { id, bps }
    );

    const payload = asRecord(data?.data) ?? data;
    const price = asRecord(payload?.price);

    return NextResponse.json({
      ...data,
      data: {
        ...payload,
        price: {
          token0:
            asNumber(price?.token0) ??
            asNumber(price?.price0) ??
            asNumber(payload?.price0),
          token1:
            asNumber(price?.token1) ??
            asNumber(price?.price1) ??
            asNumber(payload?.price1),
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load zap-out quotes";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
