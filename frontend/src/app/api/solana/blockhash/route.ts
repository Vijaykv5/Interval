import { Connection } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getSelectedSolanaNetwork, getSolanaRpcUrl } from "@/lib/solana-config";

export async function GET(req: Request) {
  try {
    const network = getSelectedSolanaNetwork(req.headers.get("cookie"));
    const connection = new Connection(getSolanaRpcUrl(network));
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
