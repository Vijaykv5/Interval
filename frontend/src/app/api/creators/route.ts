import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const creators = await prisma.creator.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        slots: {
          where: { status: "available" },
          orderBy: { startTime: "asc" },
        },
      },
    });

    const list = creators.map((c) => ({
      id: c.id,
      username: c.username,
      wallet: c.wallet,
      profileImageUrl: c.profileImageUrl,
      bio: c.bio,
      xAccount: c.xAccount,
      launchedTokenMint: c.launchedTokenMint,
      launchedTokenName: c.launchedTokenName,
      launchedTokenSymbol: c.launchedTokenSymbol,
      launchedTokenUrl: c.launchedTokenUrl,
      launchedTokenAt: c.launchedTokenAt?.toISOString() ?? null,
      firstAvailableSlot: c.slots[0]
        ? { id: c.slots[0].id, price: c.slots[0].price, currency: c.slots[0].currency }
        : null,
      availableSlots: c.slots.map((s) => ({
        id: s.id,
        price: s.price,
        currency: s.currency,
        startTime: s.startTime.toISOString(),
        endTime: s.endTime.toISOString(),
      })),
    }));

    return NextResponse.json(list);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load creators" },
      { status: 500 }
    );
  }
}
