import {
  getAssociatedTokenAddress,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getPusdMintPublicKey,
  getUsdcMintPublicKey,
  PUSD_DECIMALS,
  getSelectedSolanaNetwork,
  getSolanaRpcUrl,
  USDC_DECIMALS,
} from "@/lib/solana-config";

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
    const usdcMint = getUsdcMintPublicKey(network);

    const lamports = await connection.getBalance(owner, "confirmed");
    let pusdBaseUnits = "0";
    let pusdTokenAccountExists = false;
    let pusdAta = "";
    let usdcBaseUnits = "0";
    let usdcTokenAccountExists = false;
    let usdcAta = "";

    if (pusdMint) {
      const pusdAtaAddress = await getAssociatedTokenAddress(
        pusdMint,
        owner,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      pusdAta = pusdAtaAddress.toBase58();
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        owner,
        { mint: pusdMint },
        "confirmed"
      );

      let totalBaseUnits = BigInt(0);
      for (const account of tokenAccounts.value) {
        const parsedAmount =
          account.account.data.parsed.info.tokenAmount.amount;
        totalBaseUnits += BigInt(parsedAmount);

        if (account.pubkey.equals(pusdAtaAddress)) {
          pusdTokenAccountExists = true;
        }
      }

      pusdBaseUnits = totalBaseUnits.toString();
    }

    if (usdcMint) {
      const usdcAtaAddress = await getAssociatedTokenAddress(
        usdcMint,
        owner,
        false,
        TOKEN_PROGRAM_ID
      );
      usdcAta = usdcAtaAddress.toBase58();
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        owner,
        { mint: usdcMint },
        "confirmed"
      );

      let totalBaseUnits = BigInt(0);
      for (const account of tokenAccounts.value) {
        const parsedAmount =
          account.account.data.parsed.info.tokenAmount.amount;
        totalBaseUnits += BigInt(parsedAmount);

        if (account.pubkey.equals(usdcAtaAddress)) {
          usdcTokenAccountExists = true;
        }
      }

      usdcBaseUnits = totalBaseUnits.toString();
    }

    const creditBalance = await prisma.userCreditBalance.findUnique({
      where: { wallet },
    });

    return NextResponse.json({
      wallet,
      network,
      sol: lamports / 1e9,
      lamports,
      pusd: Number(pusdBaseUnits) / 10 ** PUSD_DECIMALS,
      pusdBaseUnits,
      pusdTokenAccountExists,
      pusdAta,
      usdc: Number(usdcBaseUnits) / 10 ** USDC_DECIMALS,
      usdcBaseUnits,
      usdcTokenAccountExists,
      usdcAta,
      bookingCreditsUsd: (creditBalance?.creditBalanceCents ?? 0) / 100,
      bookingCreditsCents: creditBalance?.creditBalanceCents ?? 0,
    });
  } catch (err) {
    console.error("User balances error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load balances" },
      { status: 500 }
    );
  }
}
