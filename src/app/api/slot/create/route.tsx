import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { creatorId, startTime, endTime, price } = body;

    if (!creatorId) {
      return NextResponse.json(
        { error: "creatorId is required" },
        { status: 400 }
      );
    }

    const creator = await prisma.creator.findUnique({
      where: { id: creatorId },
    });
    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found. Use a valid creator id from the database." },
        { status: 400 }
      );
    }

    const slot = await prisma.slot.create({
      data: {
        creatorId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        price: Number(price),
        status: "available",
      },
    });

    return NextResponse.json(slot);
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
