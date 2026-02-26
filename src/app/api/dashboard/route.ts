import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Prisma } from "@prisma/client";
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

    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
      select: { wallet: true },
    });

    const now = new Date();

    const [upcomingMeetings, earningsResult, totalBookings, mySlots, bookings, walletBalance] =
      await Promise.all([
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
        prisma.slot.findMany({
          where: { creatorId },
          orderBy: { startTime: "asc" },
        }),
        prisma.booking
          .findMany({
            where: { creatorId },
            include: { slot: true },
            orderBy: { createdAt: "desc" },
          })
          .catch((e) => {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
              return [];
            }
            throw e;
          }),
        creator
          ? (async () => {
              const rpcUrl = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");
              const connection = new Connection(rpcUrl);
              const pk = new PublicKey(creator.wallet);
              const maxRetries = 3;
              for (let i = 0; i < maxRetries; i++) {
                try {
                  const lamports = await connection.getBalance(pk, "confirmed");
                  return lamports / 1e9;
                } catch (err) {
                  const isTimeout =
                    err instanceof Error &&
                    (err.message.includes("504") || err.message.includes("timeout") || err.message.includes("Gateway Time-out"));
                  if (isTimeout && i < maxRetries - 1) {
                    await new Promise((r) => setTimeout(r, 500 * (i + 1)));
                    continue;
                  }
                  console.error("Wallet balance RPC error:", err);
                  return null;
                }
              }
              return null;
            })()
          : Promise.resolve(null),
      ]);

    const earnings = earningsResult._sum.price ?? 0;

    return NextResponse.json({
      upcomingMeetings,
      earnings,
      totalBookings,
      mySlots,
      bookings,
      walletBalance,
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load dashboard" },
      { status: 500 }
    );
  }
}
