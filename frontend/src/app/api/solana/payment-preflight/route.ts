import {
  getAccount,
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { getPusdMintPublicKey, getSelectedSolanaNetwork, getSolanaRpcUrl, PUSD_DECIMALS } from "@/lib/solana-config";

type PreflightRequest = {
  payerWallet?: string;
  creatorWallet?: string;
  currency?: "SOL" | "PUSD";
  amount?: number;
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

    const network = getSelectedSolanaNetwork(req.headers.get("cookie"));
    const connection = new Connection(getSolanaRpcUrl(network), "confirmed");
    const payer = new PublicKey(body.payerWallet);
    const creator = new PublicKey(body.creatorWallet);

    if (body.currency === "SOL") {
      const lamports = await connection.getBalance(payer, "confirmed");
      return NextResponse.json({ lamports });
    }

    const pusdMint = getPusdMintPublicKey(network);

    if (!pusdMint) {
      return NextResponse.json(
        { error: "PUSD is not configured for the current Solana network" },
        { status: 400 }
      );
    }

    const userAta = await getAssociatedTokenAddress(
      pusdMint,
      payer,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    const creatorAta = await getAssociatedTokenAddress(
      pusdMint,
      creator,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    let userTokenAmount = "0";
    let userTokenTotalAmount = "0";
    let userTokenAccountExists = false;
    let creatorTokenAccountExists = false;
    let userSourceTokenAccount = userAta.toBase58();
    let userSourceTokenAmount = "0";

    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      payer,
      { mint: pusdMint },
      "confirmed"
    );

    let totalAmount = BigInt(0);
    let richestAccountAddress = userAta.toBase58();
    let richestAccountAmount = BigInt(0);
    const requestedAmount =
      typeof body.amount === "number" && Number.isFinite(body.amount) && body.amount > 0
        ? BigInt(Math.round(body.amount * 10 ** PUSD_DECIMALS))
        : null;
    let sufficientAccountAddress: string | null = null;
    let sufficientAccountAmount = BigInt(0);

    for (const tokenAccount of tokenAccounts.value) {
      const accountAddress = tokenAccount.pubkey.toBase58();
      const parsedAmount = BigInt(tokenAccount.account.data.parsed.info.tokenAmount.amount);

      totalAmount += parsedAmount;
      userTokenAccountExists = true;

      if (accountAddress === userAta.toBase58()) {
        userTokenAmount = parsedAmount.toString();
      }

      if (parsedAmount > richestAccountAmount) {
        richestAccountAmount = parsedAmount;
        richestAccountAddress = accountAddress;
      }

      if (
        requestedAmount !== null &&
        parsedAmount >= requestedAmount &&
        (sufficientAccountAddress === null || parsedAmount > sufficientAccountAmount)
      ) {
        sufficientAccountAddress = accountAddress;
        sufficientAccountAmount = parsedAmount;
      }
    }

    userTokenTotalAmount = totalAmount.toString();
    userSourceTokenAccount = sufficientAccountAddress ?? richestAccountAddress;
    userSourceTokenAmount = (sufficientAccountAddress ? sufficientAccountAmount : richestAccountAmount).toString();

    if (!userTokenAccountExists) {
      try {
        const userAccount = await getAccount(
          connection,
          userAta,
          "confirmed",
          TOKEN_2022_PROGRAM_ID
        );
        userTokenAmount = userAccount.amount.toString();
        userTokenTotalAmount = userAccount.amount.toString();
        userSourceTokenAmount = userAccount.amount.toString();
        userTokenAccountExists = true;
      } catch (err) {
        if (!isTokenAccountMissing(err)) throw err;
      }
    }

    try {
      await getAccount(connection, creatorAta, "confirmed", TOKEN_2022_PROGRAM_ID);
      creatorTokenAccountExists = true;
    } catch (err) {
      if (!isTokenAccountMissing(err)) throw err;
    }

    return NextResponse.json({
      userAta: userAta.toBase58(),
      creatorAta: creatorAta.toBase58(),
      userTokenAmount,
      userTokenTotalAmount,
      userTokenAccountExists,
      userSourceTokenAccount,
      userSourceTokenAmount,
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
