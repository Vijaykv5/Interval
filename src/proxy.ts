import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  INVITE_ACCESS_COOKIE,
  getInviteCodes,
  isValidInviteCode,
} from "@/lib/invite-codes";

const PUBLIC_PATHS = new Set([
  "/invite",
  "/actions.json",
  "/api/invite/verify",
  "/api/action/book",
  "/api/action/book/icon",
]);

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isPublicPath = PUBLIC_PATHS.has(pathname);
  const configuredCodes = getInviteCodes();
  const inviteCookie = request.cookies.get(INVITE_ACCESS_COOKIE)?.value ?? "";
  const hasInviteAccess =
    configuredCodes.length > 0 && isValidInviteCode(inviteCookie);

  if (pathname === "/invite" && hasInviteAccess) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPath || hasInviteAccess) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Invite code required." },
      { status: 401 }
    );
  }

  const inviteUrl = new URL("/invite", request.url);
  inviteUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(inviteUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.png|images|fonts|.*\\..*).*)",
  ],
};
