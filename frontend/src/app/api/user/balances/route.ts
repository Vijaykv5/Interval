import {
  getAccount,
  getAssociatedTokenAddress,
  TokenAccountNotFoundError,
  TokenInvalidAccountOwnerError,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import {
  getPusdMintPublicKey,
  PUSD_DECIMALS,
  getSelectedSolanaNetwork,
  getSolanaRpcUrl,
} from "@/lib/solana-config";

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

    const network = getSelectedSolanaNetwork(req.headers.get("cookie"));
    const connection = new Connection(getSolanaRpcUrl(network), "confirmed");
    const owner = new PublicKey(wallet);
    const pusdMint = getPusdMintPublicKey(network);

    const lamports = await connection.getBalance(owner, "confirmed");
    let pusdBaseUnits = "0";
    let pusdTokenAccountExists = false;
    let pusdAta = "";

    if (pusdMint) {
      const pusdAtaAddress = await getAssociatedTokenAddress(pusdMint, owner);
      pusdAta = pusdAtaAddress.toBase58();

      try {
        const pusdAccount = await getAccount(connection, pusdAtaAddress, "confirmed");
        pusdBaseUnits = pusdAccount.amount.toString();
        pusdTokenAccountExists = true;
      } catch (err) {
        if (!isTokenAccountMissing(err)) throw err;
      }
    }

    return NextResponse.json({
      wallet,
      network,
      sol: lamports / 1e9,
      lamports,
      pusd: Number(pusdBaseUnits) / 10 ** PUSD_DECIMALS,
      pusdBaseUnits,
      pusdTokenAccountExists,
      pusdAta,
    });
  } catch (err) {
    console.error("User balances error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load balances" },
      { status: 500 }
    );
  }
}
