export const DIAL_BASE_URL = "https://www.dial.to/";

export function getDialBlinkUrl(actionUrl: string): string {
  const value = `solana-action:${actionUrl}`;
  return `${DIAL_BASE_URL}?action=${encodeURIComponent(value)}`;
}

export const ACTION_ICON_FALLBACK =
  "https://solana.com/favicon.ico";

export const LANDING_FAQ_ITEMS = [
  {
    question: "How does Interval work?",
    answer:
      "Creators publish available slots, users book with Solana payments, and both sides get a clear confirmation flow.",
  },
  {
    question: "Who is Interval for?",
    answer:
      "Interval is built for creators, founders, communities, and users who want paid 1:1 time without messy back-and-forth scheduling.",
  },
  {
    question: "Can creators set their own price?",
    answer: "Yes. Creators control their profile, slot availability, and booking price.",
  },
  {
    question: "What do users need to book?",
    answer: "Users need a connected wallet and enough balance for the booking payment.",
  },
];
