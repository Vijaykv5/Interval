import { NextResponse } from "next/server";
import {
  INVITE_ACCESS_COOKIE,
  getInviteCodes,
  isValidInviteCode,
  normalizeInviteCode,
} from "@/lib/invite-codes";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const configuredCodes = getInviteCodes();

  if (configuredCodes.length === 0) {
    return NextResponse.json(
      { error: "Invite access is not configured." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = typeof body?.code === "string" ? normalizeInviteCode(body.code) : "";

  if (!isValidInviteCode(code)) {
    const response = NextResponse.json(
      { error: "That invite code does not look right." },
      { status: 401 }
    );
    response.cookies.delete(INVITE_ACCESS_COOKIE);
    return response;
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: INVITE_ACCESS_COOKIE,
    value: code,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: THIRTY_DAYS,
  });

  return response;
}
