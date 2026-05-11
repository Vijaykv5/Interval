import { NextResponse } from "next/server";
import { createDodoClient, getDodoMode } from "@/lib/dodo-payments.server";
import { prisma } from "@/lib/prisma";

type CreateDodoCheckoutRequest = {
  slotId?: string;
  creatorId?: string;
  creatorWallet?: string;
  payerWallet?: string;
  price?: number;
  currency?: "SOL" | "PUSD" | "USDC";
  name?: string;
  email?: string;
  callFor?: string;
};

function getBaseUrl(req: Request) {
  const requestOrigin = new URL(req.url).origin;
  if (
    requestOrigin.includes("localhost") ||
    requestOrigin.includes("127.0.0.1")
  ) {
    return requestOrigin;
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    requestOrigin
  );
}

export async function POST(req: Request) {
  try {
    const productId = process.env.DODO_BOOKING_PRODUCT_ID?.trim();
    if (!productId) {
      return NextResponse.json(
        {
          error:
            "DODO_BOOKING_PRODUCT_ID is missing. Create a one-time Pay What You Want product in Dodo and add it to frontend/.env.local.",
        },
        { status: 500 }
      );
    }

    const body = (await req.json()) as CreateDodoCheckoutRequest;
    const slotId = body.slotId?.trim();
    const payerWallet = body.payerWallet?.trim();

    if (!slotId || !payerWallet) {
      return NextResponse.json(
        { error: "slotId and payerWallet are required." },
        { status: 400 }
      );
    }

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { creator: true },
    });

    if (!slot || slot.status !== "available") {
      return NextResponse.json(
        { error: "Slot not found or no longer available." },
        { status: 400 }
      );
    }

    if (new Date(slot.startTime).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This slot has already started and can no longer be booked." },
        { status: 400 }
      );
    }

    if (slot.currency !== "USDC") {
      return NextResponse.json(
        {
          error:
            "Dodo checkout is currently available for USDC-priced slots only.",
        },
        { status: 400 }
      );
    }

    if (body.creatorId && slot.creatorId !== body.creatorId) {
      return NextResponse.json(
        { error: "creatorId does not match this slot." },
        { status: 400 }
      );
    }

    if (body.creatorWallet && slot.creator.wallet !== body.creatorWallet) {
      return NextResponse.json(
        { error: "creatorWallet does not match this slot." },
        { status: 400 }
      );
    }

    if (body.price !== undefined && Number(body.price) !== slot.price) {
      return NextResponse.json(
        { error: "Slot price does not match." },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(slot.price * 100);
    if (!Number.isFinite(amountInCents) || amountInCents < 50) {
      return NextResponse.json(
        { error: "This slot price is too low for Dodo checkout." },
        { status: 400 }
      );
    }

    const baseUrl = getBaseUrl(req);
    const returnUrl = `${baseUrl}/payment/dodo/complete?slotId=${encodeURIComponent(
      slot.id
    )}&wallet=${encodeURIComponent(payerWallet)}`;
    const customerName = body.name?.trim();
    const customerEmail = body.email?.trim();
    const hasCustomerDetails = Boolean(customerName && customerEmail);
    const isTestMode = getDodoMode() === "test";

    const dodo = createDodoClient();
    const session = await dodo.checkoutSessions.create({
      product_cart: [
        {
          product_id: productId,
          quantity: 1,
          amount: amountInCents,
        },
      ],
      allowed_payment_method_types: isTestMode
        ? ["credit", "debit"]
        : ["credit", "debit", "crypto_currency"],
      billing_currency: "USD",
      confirm: hasCustomerDetails,
      return_url: returnUrl,
      cancel_url: `${baseUrl}/explore/${encodeURIComponent(slot.creator.username)}`,
      customer: hasCustomerDetails
        ? {
            email: customerEmail!,
            name: customerName!,
          }
        : undefined,
      metadata: {
        interval_flow: "booking",
        interval_slot_id: slot.id,
        interval_creator_id: slot.creatorId,
        interval_creator_wallet: slot.creator.wallet,
        interval_creator_username: slot.creator.username,
        interval_payer_wallet: payerWallet,
        interval_currency: "USDC",
        interval_amount: slot.price.toString(),
        ...(body.name?.trim() ? { interval_name: body.name.trim() } : {}),
        ...(body.email?.trim() ? { interval_email: body.email.trim() } : {}),
        ...(body.callFor?.trim() ? { interval_call_for: body.callFor.trim() } : {}),
      },
    });

    return NextResponse.json({
      checkoutUrl: session.checkout_url,
      sessionId: session.session_id,
    });
  } catch (error) {
    console.error("Dodo booking checkout error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to create Dodo checkout session.",
      },
      { status: 500 }
    );
  }
}
