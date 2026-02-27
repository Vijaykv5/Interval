import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

const DEVNET_RPC_URLS: string[] = [
  "https://api.devnet.solana.com",
  clusterApiUrl("devnet"),
  ...(process.env.SOLANA_RPC && process.env.SOLANA_RPC.toLowerCase().includes("devnet")
    ? [process.env.SOLANA_RPC]
    : []),
];

async function fetchWalletBalanceSol(walletAddress: string): Promise<number | null> {
  const pk = new PublicKey(walletAddress);
  const commitments: Array<"confirmed" | "finalized"> = ["finalized", "confirmed"];

  for (const rpcUrl of DEVNET_RPC_URLS) {
    for (const commitment of commitments) {
      const connection = new Connection(rpcUrl, { commitment });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const lamports = await connection.getBalance(pk, commitment);
          return lamports / 1e9;
        } catch (err) {
          const isRetryable =
            err instanceof Error &&
            (err.message.includes("504") ||
              err.message.includes("timeout") ||
              err.message.includes("Gateway Time-out") ||
              err.message.includes("fetch"));
          if (isRetryable && attempt === 0) {
            await new Promise((r) => setTimeout(r, 400));
            continue;
          }
          if (attempt === 1) {
            console.warn("Wallet balance RPC error (devnet):", rpcUrl, commitment, err);
          }
        }
      }
    }
  }
  return null;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId");
    const walletParam = searchParams.get("wallet")?.trim() || null;

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
    const walletForBalance = walletParam ?? creator?.wallet ?? null;

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
        walletForBalance ? fetchWalletBalanceSol(walletForBalance) : Promise.resolve(null),
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
