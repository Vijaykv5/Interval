import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { confirmSignatureWithPolling } from "@/lib/solana-confirmation";
import { SOLANA_RPC_URL } from "@/lib/solana-config";

type ConfirmRequest = {
  signature?: string;
  blockhash?: string;
  lastValidBlockHeight?: number;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ConfirmRequest;

    if (!body.signature || !body.blockhash || !body.lastValidBlockHeight) {
      return NextResponse.json(
        { error: "signature, blockhash, and lastValidBlockHeight are required" },
        { status: 400 }
      );
    }

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    await confirmSignatureWithPolling({
      connection,
      signature: body.signature,
      lastValidBlockHeight: body.lastValidBlockHeight,
      commitment: "confirmed",
    });

    return NextResponse.json({ confirmed: true });
  } catch (err) {
    console.error("Confirm transaction error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to confirm transaction" },
      { status: 500 }
    );
  }
}
