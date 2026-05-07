import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { LpAgentRequestError, lpAgentRequest } from "@/lib/lp-agent";

const LP_AGENT_BASE_URL = "https://api.lpagent.io/open-api/v1";

type ZapInBody = {
  wallet?: string;
  poolId?: string;
  poolProtocol?: string;
  inputSOL?: number;
  range?: number;
  strategy?: "Spot" | "Curve" | "BidAsk";
  percentX?: number;
  slippageBps?: number;
  lastValidBlockHeight?: number;
  signedSwapTxs?: string[];
  signedAddTxs?: string[];
  meta?: Record<string, unknown>;
};

type PoolInfoResponse = {
  data?: {
    type?: string;
    liquidityViz?: {
      activeBin?: {
        binId: number;
      };
    };
  };
};

type AddTxResponse = {
  data: {
    lastValidBlockHeight: number;
    swapTxsWithJito?: string[];
    addLiquidityTxsWithJito?: string[];
    meta?: Record<string, unknown>;
  };
};

type LandingAddResponse = {
  data?: {
    signature?: string;
  };
};

function assertSignedTransactionDecodes(base64Tx: string) {
  const raw = Buffer.from(base64Tx, "base64");

  try {
    VersionedTransaction.deserialize(raw);
    return;
  } catch {
    try {
      Transaction.from(raw);
      return;
    } catch {
      throw new Error("A signed transaction could not be decoded after wallet approval.");
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ZapInBody;
    const wallet = body.wallet?.trim();
    const poolId = body.poolId?.trim();
    const poolProtocol = body.poolProtocol?.trim() ?? null;
    const inputSOL = typeof body.inputSOL === "number" ? body.inputSOL : 0;
    const range = typeof body.range === "number" ? body.range : 34;
    const strategy = body.strategy ?? "Spot";
    const percentX = typeof body.percentX === "number" ? body.percentX : 0.5;
    const slippageBps = typeof body.slippageBps === "number" ? body.slippageBps : 500;

    if (!wallet || !poolId) {
      return NextResponse.json({ error: "wallet and poolId are required" }, { status: 400 });
    }
    if (inputSOL <= 0) {
      return NextResponse.json({ error: "inputSOL must be greater than 0" }, { status: 400 });
    }

    new PublicKey(wallet);

    if (body.lastValidBlockHeight && body.meta) {
      const apiKey =
        process.env.LP_AGENT_API?.trim() ||
        process.env.LP_AGENT_API_KEY?.trim() ||
        "";

      if (!apiKey) {
        return NextResponse.json(
          { error: "LP Agent API key is not configured.", stage: "landing" },
          { status: 500 }
        );
      }

      const landingPayload = {
        lastValidBlockHeight: body.lastValidBlockHeight,
        swapTxsWithJito: body.signedSwapTxs ?? [],
        addLiquidityTxsWithJito: body.signedAddTxs ?? [],
        meta: body.meta,
      };

      for (const transaction of landingPayload.swapTxsWithJito) {
        assertSignedTransactionDecodes(transaction);
      }

      for (const transaction of landingPayload.addLiquidityTxsWithJito) {
        assertSignedTransactionDecodes(transaction);
      }

      const landingResponse = await fetch(`${LP_AGENT_BASE_URL}/pools/landing-add-tx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(landingPayload),
        cache: "no-store",
      });

      const rawText = await landingResponse.text();
      let parsed: unknown = null;
      try {
        parsed = rawText ? JSON.parse(rawText) : null;
      } catch {
        parsed = null;
      }

      if (!landingResponse.ok) {
        const detail =
          parsed && typeof parsed === "object" && parsed !== null && "message" in parsed && typeof parsed.message === "string"
            ? parsed.message
            : parsed && typeof parsed === "object" && parsed !== null && "error" in parsed && typeof parsed.error === "string"
              ? parsed.error
              : rawText || "LP Agent rejected the landing request";

        console.error("LP Agent landing-add-tx failed", {
          status: landingResponse.status,
          detail,
          body: rawText,
          poolId,
          wallet,
          swapTxCount: landingPayload.swapTxsWithJito.length,
          addLiquidityTxCount: landingPayload.addLiquidityTxsWithJito.length,
          metaKeys:
            landingPayload.meta && typeof landingPayload.meta === "object"
              ? Object.keys(landingPayload.meta)
              : [],
        });
        return NextResponse.json(
          {
            error:
              "LP Agent rejected the final landing step for these signed transactions. The swap/liquidity bundle was not completed through their landing endpoint.",
            detail,
            stage: "landing",
            upstreamStatus: landingResponse.status,
            upstreamBody: parsed ?? rawText,
            txCounts: {
              swap: landingPayload.swapTxsWithJito.length,
              addLiquidity: landingPayload.addLiquidityTxsWithJito.length,
            },
          },
          { status: landingResponse.status }
        );
      }

      const landingRes = parsed as LandingAddResponse;

      return NextResponse.json({
        signature: landingRes.data?.signature ?? null,
      });
    }

    const isKnownDammPool = poolProtocol === "meteora_damm_v2";
    let poolType: string | null = poolProtocol;
    let activeBinId: number | undefined;

    if (!isKnownDammPool) {
      const poolInfo = await lpAgentRequest<PoolInfoResponse>(
        "GET",
        `/pools/${encodeURIComponent(poolId)}/info`
      );
      poolType = poolInfo.data?.type ?? poolType;
      activeBinId = poolInfo.data?.liquidityViz?.activeBin?.binId;
    }

    const isDlmmPool = typeof activeBinId === "number";

    const fromBinId = isDlmmPool && activeBinId != null ? activeBinId - range : null;
    const toBinId = isDlmmPool && activeBinId != null ? activeBinId + range : null;

    const addTxRes = await lpAgentRequest<AddTxResponse>(
      "POST",
      `/pools/${encodeURIComponent(poolId)}/add-tx`,
      {
        stratergy: strategy,
        inputSOL,
        percentX,
        ...(isDlmmPool ? { fromBinId, toBinId } : {}),
        owner: wallet,
        slippage_bps: slippageBps,
        mode: "zap-in",
      }
    );

    const swapTxsWithJito = addTxRes.data.swapTxsWithJito ?? [];
    const addLiquidityTxsWithJito = addTxRes.data.addLiquidityTxsWithJito ?? [];

    if (swapTxsWithJito.length + addLiquidityTxsWithJito.length === 0) {
      return NextResponse.json(
        {
          error:
            "LP Agent generated no zap-in transactions for this pool and amount. Your wallet was not charged and no swap was attempted. Try a larger SOL amount or a more liquid pool.",
          stage: "prepare",
          poolId,
          poolType,
          inputSOL,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      lastValidBlockHeight: addTxRes.data.lastValidBlockHeight,
      swapTxsWithJito,
      addLiquidityTxsWithJito,
      poolType,
      fromBinId,
      toBinId,
      activeBinId,
      meta: addTxRes.data.meta ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to zap in";
    const status = error instanceof LpAgentRequestError ? error.status : 500;
    return NextResponse.json({ error: message, stage: "prepare" }, { status });
  }
}
