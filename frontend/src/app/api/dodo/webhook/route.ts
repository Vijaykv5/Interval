import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { Payments } from "dodopayments/resources/payments";
import { finalizeDodoBookingPayment } from "@/lib/dodo-bookings.server";
import { createDodoClient } from "@/lib/dodo-payments.server";
import { prisma } from "@/lib/prisma";

function webhookHeaders(req: Request) {
  return {
    "webhook-id": req.headers.get("webhook-id") ?? "",
    "webhook-signature": req.headers.get("webhook-signature") ?? "",
    "webhook-timestamp": req.headers.get("webhook-timestamp") ?? "",
  };
}

async function markTopupState({
  topupId,
  payment,
  status,
}: {
  topupId: string;
  payment: Payments.Payment;
  status: "processing" | "failed" | "cancelled" | "succeeded";
}) {
  const wallet = payment.metadata?.interval_wallet?.trim();

  await prisma.$transaction(async (tx) => {
    const current = await tx.dodoTopup.findUnique({
      where: { id: topupId },
    });

    if (!current) {
      return;
    }

    const alreadySucceeded = current.status === "succeeded";
    const shouldCredit = status === "succeeded" && !alreadySucceeded;

    await tx.dodoTopup.update({
      where: { id: topupId },
      data: {
        status,
        providerStatus: payment.status ?? status,
        paymentId: payment.payment_id,
        currency: payment.currency,
        metadata: JSON.parse(JSON.stringify(payment)) as Prisma.InputJsonValue,
        completedAt: status === "succeeded" ? new Date() : current.completedAt,
      },
    });

    if (shouldCredit && wallet) {
      await tx.userCreditBalance.upsert({
        where: { wallet },
        create: {
          wallet,
          creditBalanceCents: current.amountUsdCents,
          lifetimeTopupCents: current.amountUsdCents,
        },
        update: {
          creditBalanceCents: { increment: current.amountUsdCents },
          lifetimeTopupCents: { increment: current.amountUsdCents },
        },
      });
    }
  });
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  try {
    const dodo = createDodoClient();
    const event = dodo.webhooks.unwrap(rawBody, {
      headers: webhookHeaders(req),
    });

    if (!event || !("type" in event)) {
      return NextResponse.json({ received: true });
    }

    if (
      event.type === "payment.succeeded" ||
      event.type === "payment.failed" ||
      event.type === "payment.processing" ||
      event.type === "payment.cancelled"
    ) {
      const payment = event.data;
      const topupId = payment.metadata?.interval_topup_id?.trim();

      if (topupId) {
        const status =
          event.type === "payment.succeeded"
            ? "succeeded"
            : event.type === "payment.failed"
              ? "failed"
              : event.type === "payment.cancelled"
                ? "cancelled"
                : "processing";

        await markTopupState({ topupId, payment, status });
      }

      if (event.type === "payment.succeeded") {
        await finalizeDodoBookingPayment(payment);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Dodo webhook error:", error);
    return NextResponse.json(
      { error: "Invalid Dodo webhook payload." },
      { status: 400 }
    );
  }
}
