import { Connection, clusterApiUrl } from "@solana/web3.js";
import { NextResponse } from "next/server";

const network = process.env.SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet-beta";
const rpcUrl = process.env.SOLANA_RPC ?? clusterApiUrl(network);

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

    const connection = new Connection(rpcUrl, "confirmed");
    const confirmation = await connection.confirmTransaction(
      {
        signature: body.signature,
        blockhash: body.blockhash,
        lastValidBlockHeight: body.lastValidBlockHeight,
      },
      "confirmed"
    );

    if (confirmation.value.err) {
      return NextResponse.json(
        { error: "Transaction failed to confirm", details: confirmation.value.err },
        { status: 400 }
      );
    }

    return NextResponse.json({ confirmed: true });
  } catch (err) {
    console.error("Confirm transaction error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to confirm transaction" },
      { status: 500 }
    );
  }
}
