import { Connection, clusterApiUrl } from "@solana/web3.js";
import { NextResponse } from "next/server";

const rpcUrl = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");

export async function GET() {
  try {
    const connection = new Connection(rpcUrl);
    const [latestBlockhash, slot, blockHeight] = await Promise.all([
      connection.getLatestBlockhash("confirmed"),
      connection.getSlot("confirmed"),
      connection.getBlockHeight("confirmed"),
    ]);
    return NextResponse.json({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      slot,
      blockHeight,
    });
  } catch (err) {
    console.error("getLatestBlockhash error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to get blockhash",
      },
      { status: 500 }
    );
  }
}
