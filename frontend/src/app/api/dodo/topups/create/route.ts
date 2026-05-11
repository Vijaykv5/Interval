import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createDodoClient,
  formatUsdFromCents,
  getDodoTopupPack,
  getDodoTopupProductId,
} from "@/lib/dodo-payments.server";

type CreateTopupRequest = {
  walletAddress?: string;
  packId?: string;
};

function getBaseUrl(req: Request) {
  const url = new URL(req.url);
  if (
    url.origin.includes("localhost") ||
    url.origin.includes("127.0.0.1")
  ) {
    return url.origin.replace(/\/$/, "");
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "") ||
    url.origin
  ).replace(/\/$/, "");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateTopupRequest;
    const walletAddress = body.walletAddress?.trim();
    const pack = body.packId ? getDodoTopupPack(body.packId) : null;

    if (!walletAddress || !pack) {
      return NextResponse.json(
        { error: "walletAddress and a valid packId are required." },
        { status: 400 }
      );
    }

    const productId = getDodoTopupProductId(pack);
    if (!productId) {
      return NextResponse.json(
        {
          error: `Missing ${pack.envKey}. Create the Dodo product for the ${pack.creditsUsd} USD pack and add its product id to frontend/.env.local.`,
        },
        { status: 500 }
      );
    }

    const topup = await prisma.dodoTopup.create({
      data: {
        wallet: walletAddress,
        packId: pack.id,
        productId,
        checkoutSessionId: `pending_${crypto.randomUUID()}`,
        amountUsdCents: pack.amountUsdCents,
        metadata: {
          walletAddress,
          packId: pack.id,
          creditsUsd: pack.creditsUsd,
        },
      },
    });

    const returnUrl = `${getBaseUrl(req)}/profile?topup=1&topupId=${encodeURIComponent(topup.id)}`;
    const dodo = createDodoClient();
    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: returnUrl,
      metadata: {
        interval_topup_id: topup.id,
        interval_wallet: walletAddress,
        interval_pack: pack.id,
        interval_credits_usd: String(pack.creditsUsd),
      },
    });

    await prisma.dodoTopup.update({
      where: { id: topup.id },
      data: {
        checkoutSessionId: session.session_id,
        checkoutUrl: session.checkout_url ?? null,
        metadata: {
          walletAddress,
          packId: pack.id,
          creditsUsd: pack.creditsUsd,
          checkoutSessionId: session.session_id,
        },
      },
    });

    return NextResponse.json({
      topupId: topup.id,
      sessionId: session.session_id,
      checkoutUrl: session.checkout_url,
      amountUsd: formatUsdFromCents(pack.amountUsdCents),
      creditsUsd: pack.creditsUsd,
    });
  } catch (error) {
    console.error("Dodo topup session error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create Dodo checkout session." },
      { status: 500 }
    );
  }
}
