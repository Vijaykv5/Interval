import { prisma } from "@/lib/prisma";
import {
  creatorAccessCookieOptions,
  CREATOR_ACCESS_PENDING_COOKIE,
  CREATOR_ACCESS_WALLET_COOKIE,
  getAllowedCreatorAccessCodes,
  normalizeCreatorAccessCode,
} from "@/lib/creator-access";
import { NextRequest, NextResponse } from "next/server";

async function hasCreatorProfile(wallet: string) {
  const creator = await prisma.creator.findUnique({
    where: { wallet },
    select: { id: true },
  });
  return Boolean(creator);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet")?.trim();

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required." },
        { status: 400 }
      );
    }

    const creatorExists = await hasCreatorProfile(wallet);
    const grantedWallet = req.cookies.get(CREATOR_ACCESS_WALLET_COOKIE)?.value?.trim();
    const hasAccess = creatorExists || grantedWallet === wallet;

    return NextResponse.json({
      ok: true,
      creatorExists,
      hasAccess,
    });
  } catch (error) {
    console.error("[creator-access:get]", error);
    return NextResponse.json(
      { error: "Failed to read creator access state." },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const submittedCode =
      typeof body?.code === "string" ? normalizeCreatorAccessCode(body.code) : "";

    if (!submittedCode) {
      return NextResponse.json(
        { error: "Access code is required." },
        { status: 400 }
      );
    }

    const allowedCodes = getAllowedCreatorAccessCodes();
    if (allowedCodes.length === 0) {
      console.error("[creator-access] No creator access codes configured.");
      return NextResponse.json(
        { error: "Creator access is not configured right now." },
        { status: 500 }
      );
    }

    if (!allowedCodes.includes(submittedCode)) {
      return NextResponse.json(
        { error: "That access code is not valid for creator sign up." },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(CREATOR_ACCESS_PENDING_COOKIE, "granted", {
      ...creatorAccessCookieOptions(),
      maxAge: 60 * 30,
    });
    return response;
  } catch (error) {
    console.error("[creator-access:post]", error);
    return NextResponse.json(
      { error: "Failed to verify creator access code." },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const pendingAccess = req.cookies.get(CREATOR_ACCESS_PENDING_COOKIE)?.value;
    if (pendingAccess !== "granted") {
      return NextResponse.json(
        { error: "Creator access has not been verified yet." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const wallet = typeof body?.wallet === "string" ? body.wallet.trim() : "";

    if (!wallet) {
      return NextResponse.json(
        { error: "wallet is required." },
        { status: 400 }
      );
    }

    const response = NextResponse.json({ ok: true, wallet });
    response.cookies.set(CREATOR_ACCESS_WALLET_COOKIE, wallet, {
      ...creatorAccessCookieOptions(),
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.delete(CREATOR_ACCESS_PENDING_COOKIE);
    return response;
  } catch (error) {
    console.error("[creator-access:patch]", error);
    return NextResponse.json(
      { error: "Failed to complete creator access." },
      { status: 500 }
    );
  }
}
