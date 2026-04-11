export const DIAL_BASE_URL = "https://www.dial.to/";

export function getDialBlinkUrl(actionUrl: string): string {
  const value = `solana-action:${actionUrl}`;
  return `${DIAL_BASE_URL}?action=${encodeURIComponent(value)}`;
}

export const ACTION_ICON_FALLBACK =
  "https://solana.com/favicon.ico";
