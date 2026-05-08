export const CREATOR_ACCESS_PENDING_COOKIE = "interval_creator_access_pending";
export const CREATOR_ACCESS_WALLET_COOKIE = "interval_creator_access_wallet";

export function normalizeCreatorAccessCode(code: string) {
  return code.trim().toUpperCase();
}

export function getAllowedCreatorAccessCodes() {
  const raw =
    process.env.CREATOR_ACCESS_CODES?.trim() ||
    process.env.CREATOR_ACCESS_CODE?.trim() ||
    process.env.INVITE_CODES?.trim() ||
    "";

  return raw
    .split(",")
    .map(normalizeCreatorAccessCode)
    .filter(Boolean);
}

export function creatorAccessCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}
