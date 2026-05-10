import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
type UnknownRecord = { [key: string]: JsonValue };

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function normalizeStatus(value: string | null) {
  const raw = (value ?? "").toLowerCase();

  if (raw.includes("settled") || raw.includes("completed") || raw.includes("success")) {
    return "settled";
  }

  if (raw.includes("failed") || raw.includes("cancel") || raw.includes("rejected")) {
    return "failed";
  }

  return "pending";
}

function extractCandidateStrings(body: UnknownRecord) {
  const data = (body.data && typeof body.data === "object" ? body.data : {}) as UnknownRecord;
  const metadata = (data.metadata && typeof data.metadata === "object" ? data.metadata : {}) as UnknownRecord;

  return {
    customOrderId:
      getString(body.customOrderId) ||
      getString(body.orderId) ||
      getString(data.customOrderId) ||
      getString(metadata.customOrderId),
    checkoutCode:
      getString(body.code) ||
      getString(body.linkCode) ||
      getString(data.code) ||
      getString(data.linkCode),
    providerStatus:
      getString(body.status) ||
      getString(body.event) ||
      getString(body.type) ||
      getString(data.status) ||
      getString(data.paymentStatus),
  };
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as UnknownRecord;
    const { customOrderId, checkoutCode, providerStatus } = extractCandidateStrings(body);

    if (!customOrderId && !checkoutCode) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const kiraPaymentOrFilters: Prisma.KiraPaymentWhereInput[] = [];
    if (customOrderId) {
      kiraPaymentOrFilters.push({ customOrderId });
    }
    if (checkoutCode) {
      kiraPaymentOrFilters.push({ checkoutCode });
    }

    const payment = await prisma.kiraPayment.findFirst({
      where: {
        OR: kiraPaymentOrFilters,
      },
    });

    if (!payment) {
      return NextResponse.json({ received: true, ignored: true });
    }

    const normalized = normalizeStatus(providerStatus);

    if (normalized === "settled") {
      await prisma.$transaction(async (tx) => {
        const currentPayment = await tx.kiraPayment.findUnique({
          where: { id: payment.id },
        });

        if (!currentPayment) return;

        let bookingId = currentPayment.bookingId ?? null;
        const existingBooking = await tx.booking.findUnique({
          where: { slotId: currentPayment.slotId },
        });

        if (existingBooking) {
          bookingId = existingBooking.id;
        } else {
          const slot = await tx.slot.findUnique({
            where: { id: currentPayment.slotId },
          });

          if (slot && slot.status === "available") {
            const booking = await tx.booking.create({
              data: {
                slotId: currentPayment.slotId,
                creatorId: currentPayment.creatorId,
                payerWallet: currentPayment.payerWallet,
                amountSol: slot.currency === "SOL" ? slot.price : 0,
                amount: slot.price,
                currency: slot.currency,
                txSignature: null,
                signature: currentPayment.customOrderId,
                status: "confirmed",
              },
            });

            await tx.slot.update({
              where: { id: slot.id },
              data: { status: "booked" },
            });

            bookingId = booking.id;
          }
        }

        await tx.kiraPayment.update({
          where: { id: currentPayment.id },
          data: {
            status: "settled",
            providerStatus: providerStatus ?? "settled",
            bookingId,
            rawPayload: body as Prisma.InputJsonValue,
          },
        });
      });
    } else if (normalized === "failed") {
      await prisma.kiraPayment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          providerStatus: providerStatus ?? "failed",
          rawPayload: body as Prisma.InputJsonValue,
        },
      });
    } else {
      await prisma.kiraPayment.update({
        where: { id: payment.id },
        data: {
          status: "pending",
          providerStatus: providerStatus ?? "pending",
          rawPayload: body as Prisma.InputJsonValue,
        },
      });
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("KIRAPAY webhook error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Webhook handling failed." },
      { status: 500 }
    );
  }
}
