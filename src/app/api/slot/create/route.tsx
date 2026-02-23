import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, startTime, endTime, price } = body;

    if (!wallet || typeof wallet !== "string" || wallet.length === 0) {
      return NextResponse.json(
        { error: "wallet is required (connected Privy wallet address)" },
        { status: 400 }
      );
    }

    const creator = await prisma.creator.findUnique({
      where: { wallet },
    });
    if (!creator) {
      return NextResponse.json(
        { error: "No creator profile for this wallet. Complete onboarding first." },
        { status: 400 }
      );
    }

    const slot = await prisma.slot.create({
      data: {
        creatorId: creator.id,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        price: Number(price),
        status: "available",
      },
    });

    const origin = new URL(req.url).origin;
    const blinkUrl = `${origin}/api/action/book?slotId=${slot.id}`;

    return NextResponse.json({ ...slot, blinkUrl });
  } catch (err: unknown) {
    const isForeignKeyError =
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code: string }).code === "P2003";
    if (isForeignKeyError) {
      return NextResponse.json(
        { error: "Creator not found. Use a valid creator id." },
        { status: 400 }
      );
    }
    throw err;
  }
}
