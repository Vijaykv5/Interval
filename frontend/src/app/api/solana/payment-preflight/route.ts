import {
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getPusdMintPublicKey, SOLANA_RPC_URL } from "@/lib/solana-config";

const PUSD_MINT = getPusdMintPublicKey();

type PreflightRequest = {
  payerWallet?: string;
  creatorWallet?: string;
  currency?: "SOL" | "PUSD";
};

function isTokenAccountMissing(err: unknown) {
  return (
    err instanceof TokenAccountNotFoundError ||
    err instanceof TokenInvalidAccountOwnerError
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PreflightRequest;

    if (!body.payerWallet || !body.creatorWallet || !body.currency) {
      return NextResponse.json(
        { error: "payerWallet, creatorWallet, and currency are required" },
        { status: 400 }
      );
    }

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    const payer = new PublicKey(body.payerWallet);
    const creator = new PublicKey(body.creatorWallet);

    if (body.currency === "SOL") {
      const lamports = await connection.getBalance(payer, "confirmed");
      return NextResponse.json({ lamports });
    }

    if (!PUSD_MINT) {
      return NextResponse.json(
        { error: "PUSD is not configured for the current Solana network" },
        { status: 400 }
      );
    }

    const userAta = await getAssociatedTokenAddress(PUSD_MINT, payer);
    const creatorAta = await getAssociatedTokenAddress(PUSD_MINT, creator);

    let userTokenAmount = "0";
    let userTokenAccountExists = false;
    let creatorTokenAccountExists = false;

    try {
      const userAccount = await getAccount(connection, userAta, "confirmed");
      userTokenAmount = userAccount.amount.toString();
      userTokenAccountExists = true;
    } catch (err) {
      if (!isTokenAccountMissing(err)) throw err;
    }

    try {
      await getAccount(connection, creatorAta, "confirmed");
      creatorTokenAccountExists = true;
    } catch (err) {
      if (!isTokenAccountMissing(err)) throw err;
    }

    return NextResponse.json({
      userAta: userAta.toBase58(),
      creatorAta: creatorAta.toBase58(),
      userTokenAmount,
      userTokenAccountExists,
      creatorTokenAccountExists,
    });
  } catch (err) {
    console.error("Payment preflight error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Payment preflight failed" },
      { status: 500 }
    );
  }
}
