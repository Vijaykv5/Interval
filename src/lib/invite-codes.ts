export const INVITE_ACCESS_COOKIE = "interval_invite_access";

const INVITE_CODE_PATTERN = /^[A-Za-z]{6}$/;

export function normalizeInviteCode(code: string) {
  return code.trim().toUpperCase();
}

export function getInviteCodes() {
  const raw = process.env.INVITE_CODES?.trim();

  if (!raw) {
    return [];
  }

  const values = raw.startsWith("[")
    ? parseJsonCodes(raw)
    : raw.split(",");

  return values
    .map((code) => normalizeInviteCode(code))
    .filter((code, index, codes) => INVITE_CODE_PATTERN.test(code) && codes.indexOf(code) === index);
}

export function isValidInviteCode(code: string) {
  const normalizedCode = normalizeInviteCode(code);

  if (!INVITE_CODE_PATTERN.test(normalizedCode)) {
    return false;
  }

  return getInviteCodes().includes(normalizedCode);
}

function parseJsonCodes(raw: string) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((code): code is string => typeof code === "string") : [];
  } catch {
    return [];
  }
}
