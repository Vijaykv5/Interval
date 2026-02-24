import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet");

    if (!wallet || wallet.length === 0) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    const creator = await prisma.creator.findUnique({
      where: { wallet },
    });

    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(creator);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to load creator" },
      { status: 500 }
    );
  }
}

function trimOptional(str: unknown): string | null {
  if (str == null) return null;
  if (typeof str !== "string") return null;
  const t = str.trim();
  return t.length > 0 ? t : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wallet, username, profileImageUrl, bio, xAccount } = body;

    if (!wallet || typeof wallet !== "string" || wallet.length === 0) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }
    if (!username || typeof username !== "string" || username.trim().length === 0) {
      return NextResponse.json(
        { error: "username is required" },
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();

    const existingByWallet = await prisma.creator.findUnique({
      where: { wallet },
    });
    if (existingByWallet) {
      return NextResponse.json(
        { error: "A profile already exists for this wallet" },
        { status: 400 }
      );
    }

    const existingByUsername = await prisma.creator.findUnique({
      where: { username: trimmedUsername },
    });
    if (existingByUsername) {
      return NextResponse.json(
        { error: "Username is already taken" },
        { status: 400 }
      );
    }

    const creator = await prisma.creator.create({
      data: {
        wallet,
        username: trimmedUsername,
        profileImageUrl: trimOptional(profileImageUrl) ?? null,
        bio: trimOptional(bio) ?? null,
        xAccount: trimOptional(xAccount) ?? null,
      },
    });

    return NextResponse.json(creator);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to create creator" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { wallet, username, profileImageUrl, bio, xAccount } = body;

    if (!wallet || typeof wallet !== "string" || wallet.length === 0) {
      return NextResponse.json(
        { error: "wallet is required" },
        { status: 400 }
      );
    }

    const creator = await prisma.creator.findUnique({
      where: { wallet },
    });
    if (!creator) {
      return NextResponse.json(
        { error: "Creator not found" },
        { status: 404 }
      );
    }

    const data: { username?: string; profileImageUrl?: string | null; bio?: string | null; xAccount?: string | null } = {};
    if (username !== undefined) {
      const trimmed = typeof username === "string" ? username.trim() : "";
      if (trimmed.length === 0) {
        return NextResponse.json(
          { error: "username cannot be empty" },
          { status: 400 }
        );
      }
      if (trimmed !== creator.username) {
        const taken = await prisma.creator.findUnique({
          where: { username: trimmed },
        });
        if (taken) {
          return NextResponse.json(
            { error: "Username is already taken" },
            { status: 400 }
          );
        }
        data.username = trimmed;
      }
    }
    if (profileImageUrl !== undefined) data.profileImageUrl = trimOptional(profileImageUrl);
    if (bio !== undefined) data.bio = trimOptional(bio);
    if (xAccount !== undefined) data.xAccount = trimOptional(xAccount);

    const updated = await prisma.creator.update({
      where: { id: creator.id },
      data,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to update creator" },
      { status: 500 }
    );
  }
}
