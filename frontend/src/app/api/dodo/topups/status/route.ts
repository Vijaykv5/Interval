import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatUsdFromCents } from "@/lib/dodo-topup-packs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const topupId = searchParams.get("topupId")?.trim();
    const wallet = searchParams.get("wallet")?.trim();

    if (!topupId || !wallet) {
      return NextResponse.json(
        { error: "topupId and wallet are required." },
        { status: 400 }
      );
    }

    const topup = await prisma.dodoTopup.findFirst({
      where: { id: topupId, wallet },
    });

    if (!topup) {
      return NextResponse.json({ error: "Top-up not found." }, { status: 404 });
    }

    const creditBalance = await prisma.userCreditBalance.findUnique({
      where: { wallet },
    });

    return NextResponse.json({
      topupId: topup.id,
      status: topup.status,
      providerStatus: topup.providerStatus,
      amountUsd: formatUsdFromCents(topup.amountUsdCents),
      creditBalanceUsd: formatUsdFromCents(creditBalance?.creditBalanceCents ?? 0),
      completedAt: topup.completedAt?.toISOString() ?? null,
    });
  } catch (error) {
    console.error("Dodo topup status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load top-up status." },
      { status: 500 }
    );
  }
}
