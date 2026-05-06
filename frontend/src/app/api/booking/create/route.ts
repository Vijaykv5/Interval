import { prisma } from "@/lib/prisma";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { NextResponse } from "next/server";

type BookingRequest = {
  slotId?: string;
  creatorId?: string;
  userId?: string;
  payerWallet?: string;
  amount?: number;
  currency?: "SOL" | "PUSD";
  txSignature?: string;
  name?: string;
  email?: string;
  callFor?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BookingRequest;
    const slotId = body.slotId?.trim();
    const payerWallet = (body.userId ?? body.payerWallet)?.trim();
    const txSignature = body.txSignature?.trim();

    if (!slotId || !payerWallet || !txSignature) {
      return NextResponse.json(
        { error: "slotId, userId, and txSignature are required" },
        { status: 400 }
      );
    }

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { creator: true },
    });

    if (!slot || slot.status !== "available") {
      return NextResponse.json(
        { error: "Slot not found or no longer available" },
        { status: 400 }
      );
    }

    const amount = Number(body.amount ?? slot.price);
    const currency = body.currency ?? slot.currency;

    if (slot.creatorId !== body.creatorId && body.creatorId) {
      return NextResponse.json(
        { error: "creatorId does not match this slot" },
        { status: 400 }
      );
    }

    if (amount !== slot.price || currency !== slot.currency) {
      return NextResponse.json(
        { error: "Booking amount or currency does not match the slot" },
        { status: 400 }
      );
    }

    const accessToken = crypto.randomUUID();
    const name = body.name?.trim() || null;
    const email = body.email?.trim() || null;
    const callFor = body.callFor?.trim() || null;

    const [booking] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          slotId: slot.id,
          creatorId: slot.creatorId,
          payerWallet,
          amountSol: currency === "SOL" ? amount : 0,
          amount,
          currency,
          txSignature,
          signature: txSignature,
          status: "confirmed",
          name,
          email,
          callFor,
          accessToken,
        },
      }),
      prisma.slot.update({
        where: { id: slot.id },
        data: { status: "booked" },
      }),
    ]);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;
    const joinUrl = `${baseUrl}/booking/${booking.id}?token=${accessToken}`;

    if (email) {
      sendBookingConfirmationEmail({
        to: email,
        creatorName: slot.creator.username,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
        joinUrl,
        meetLink: slot.meetLink,
        amount,
        currency,
      }).catch((err) => console.error("Confirmation email failed:", err));
    }

    return NextResponse.json({ booking, joinUrl });
  } catch (err) {
    console.error("Create booking error:", err);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
