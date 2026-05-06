import {
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { NextResponse } from "next/server";

const PUSD_MINT = new PublicKey("CzzgUBvxaMLwMhVSLgqJn3npmxoTo6nzMNQPAnwtHF3s");
const network = process.env.SOLANA_NETWORK === "devnet" ? "devnet" : "mainnet-beta";
const rpcUrl = process.env.SOLANA_RPC ?? clusterApiUrl(network);

function isTokenAccountMissing(err: unknown) {
  return (
    err instanceof TokenAccountNotFoundError ||
    err instanceof TokenInvalidAccountOwnerError
  );
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet")?.trim();

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    const connection = new Connection(rpcUrl, "confirmed");
    const owner = new PublicKey(wallet);
    const pusdAta = await getAssociatedTokenAddress(PUSD_MINT, owner);

    const lamports = await connection.getBalance(owner, "confirmed");
    let pusdBaseUnits = "0";
    let pusdTokenAccountExists = false;

    try {
      const pusdAccount = await getAccount(connection, pusdAta, "confirmed");
      pusdBaseUnits = pusdAccount.amount.toString();
      pusdTokenAccountExists = true;
    } catch (err) {
      if (!isTokenAccountMissing(err)) throw err;
    }

    return NextResponse.json({
      wallet,
      network,
      sol: lamports / 1e9,
      lamports,
      pusd: Number(pusdBaseUnits) / 1e6,
      pusdBaseUnits,
      pusdTokenAccountExists,
      pusdAta: pusdAta.toBase58(),
    });
  } catch (err) {
    console.error("User balances error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load balances" },
      { status: 500 }
    );
  }
}
