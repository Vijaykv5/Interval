import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ReleaseRequest = {
  bookingId?: string;
  wallet?: string;
  releaseSignature?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReleaseRequest;
    const bookingId = body.bookingId?.trim();
    const wallet = body.wallet?.trim();

    if (!bookingId || !wallet) {
      return NextResponse.json(
        { error: "bookingId and wallet are required" },
        { status: 400 }
      );
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { creator: true },
    });

    if (!booking) {
      return NextResponse.json(
        { error: "Booking not found" },
        { status: 404 }
      );
    }

    if (booking.creator.wallet !== wallet) {
      return NextResponse.json(
        { error: "Only the creator wallet can mark this booking as released" },
        { status: 403 }
      );
    }

    if (booking.status === "released") {
      return NextResponse.json({ ok: true, booking });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: "released" },
    });

    return NextResponse.json({
      ok: true,
      booking: updated,
      releaseSignature: body.releaseSignature?.trim() || null,
    });
  } catch (err) {
    console.error("Release booking error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to mark booking as released" },
      { status: 500 }
    );
  }
}
