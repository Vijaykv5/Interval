import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");

    if (!creatorId) {
      return NextResponse.json(
        { error: "creatorId is required" },
        { status: 400 }
      );
    }

    const now = new Date();

    const [upcomingMeetings, earningsResult, totalBookings] = await Promise.all([
      prisma.slot.findMany({
        where: {
          creatorId,
          status: "booked",
          endTime: { gte: now },
        },
        orderBy: { startTime: "asc" },
      }),
      prisma.slot.aggregate({
        where: {
          creatorId,
          status: "booked",
        },
        _sum: { price: true },
      }),
      prisma.slot.count({
        where: {
          creatorId,
          status: "booked",
        },
      }),
    ]);

    const earnings = earningsResult._sum.price ?? 0;

    return NextResponse.json({
      upcomingMeetings,
      earnings,
      totalBookings,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
