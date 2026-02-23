import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const creators = await prisma.creator.findMany();
  return NextResponse.json(creators);
}
