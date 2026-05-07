import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { LpAgentRequestError, lpAgentRequest } from "@/lib/lp-agent";

type ZapOutBody = {
  wallet?: string;
  positionId?: string;
  bps?: number;
  output?: "allBaseToken" | "both" | "allToken0" | "allToken1";
  slippageBps?: number;
  provider?: string;
  lastValidBlockHeight?: number;
  signedCloseTxs?: string[];
  signedSwapTxs?: string[];
};

type DecreaseTxResponse = {
  data: {
    lastValidBlockHeight: number;
    closeTxsWithJito?: string[];
    swapTxsWithJito?: string[];
  };
};

type LandingDecreaseResponse = {
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
      throw new Error("A signed zap-out transaction could not be decoded after wallet approval.");
    }
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ZapOutBody;
    const wallet = body.wallet?.trim();
    const positionId = body.positionId?.trim();
    const bps = typeof body.bps === "number" ? body.bps : 10000;
    const output = body.output ?? "allBaseToken";
    const slippageBps = typeof body.slippageBps === "number" ? body.slippageBps : 500;
    const provider = body.provider ?? "JUPITER_ULTRA";

    if (!wallet || !positionId) {
      return NextResponse.json({ error: "wallet and positionId are required" }, { status: 400 });
    }

    new PublicKey(wallet);

    if (body.lastValidBlockHeight) {
      const signedCloseTxs = body.signedCloseTxs ?? [];
      const signedSwapTxs = body.signedSwapTxs ?? [];

      if (signedCloseTxs.length + signedSwapTxs.length === 0) {
        return NextResponse.json(
          { error: "No signed zap-out transactions were provided for landing.", stage: "landing" },
          { status: 400 }
        );
      }

      for (const transaction of signedCloseTxs) {
        assertSignedTransactionDecodes(transaction);
      }

      for (const transaction of signedSwapTxs) {
        assertSignedTransactionDecodes(transaction);
      }

      const landingRes = await lpAgentRequest<LandingDecreaseResponse>(
        "POST",
        "/position/landing-decrease-tx",
        {
          lastValidBlockHeight: body.lastValidBlockHeight,
          closeTxs: [],
          swapTxs: [],
          closeTxsWithJito: signedCloseTxs,
          swapTxsWithJito: signedSwapTxs,
        }
      );

      return NextResponse.json({
        signature: landingRes.data?.signature ?? null,
        bps,
        output,
      });
    }

    const decreaseTxRes = await lpAgentRequest<DecreaseTxResponse>(
      "POST",
      "/position/decrease-tx",
      {
        position_id: positionId,
        bps,
        owner: wallet,
        slippage_bps: slippageBps,
        output,
        provider,
      }
    );

    const closeTxsWithJito = decreaseTxRes.data.closeTxsWithJito ?? [];
    const swapTxsWithJito = decreaseTxRes.data.swapTxsWithJito ?? [];

    if (closeTxsWithJito.length + swapTxsWithJito.length === 0) {
      return NextResponse.json(
        {
          error:
            "LP Agent generated no zap-out transactions for this position. No exit transaction was prepared.",
          stage: "prepare",
          positionId,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      lastValidBlockHeight: decreaseTxRes.data.lastValidBlockHeight,
      closeTxsWithJito,
      swapTxsWithJito,
      bps,
      output,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to zap out";
    const status = error instanceof LpAgentRequestError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
