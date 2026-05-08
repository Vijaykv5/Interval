import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet")?.trim();

    if (!wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }

    const bookings = await prisma.booking.findMany({
      where: { payerWallet: wallet },
      include: {
        creator: {
          select: {
            id: true,
            username: true,
            profileImageUrl: true,
          },
        },
        slot: {
          select: {
            id: true,
            startTime: true,
            endTime: true,
            meetLink: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    const now = Date.now();
    const upcomingBookings = bookings
      .filter((booking) => new Date(booking.slot.startTime).getTime() >= now)
      .sort(
        (a, b) =>
          new Date(a.slot.startTime).getTime() - new Date(b.slot.startTime).getTime()
      );

    const totals = bookings.reduce(
      (acc, booking) => {
        acc[booking.currency] += booking.amount;
        return acc;
      },
      { SOL: 0, PUSD: 0 }
    );

    return NextResponse.json({
      bookings,
      nextBooking: upcomingBookings[0] ?? null,
      upcomingCount: upcomingBookings.length,
      completedCount: bookings.filter((booking) => new Date(booking.slot.endTime).getTime() < now)
        .length,
      totalSpent: totals,
    });
  } catch (err) {
    console.error("User bookings error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load bookings" },
      { status: 500 }
    );
  }
}
