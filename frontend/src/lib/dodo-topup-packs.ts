export type DodoTopupPack = {
  id: "starter" | "growth" | "pro";
  label: string;
  creditsUsd: number;
  amountUsdCents: number;
  envKey: string;
  accent: string;
  caption: string;
};

export const DODO_TOPUP_PACKS: DodoTopupPack[] = [
  {
    id: "starter",
    label: "Starter",
    creditsUsd: 10,
    amountUsdCents: 1000,
    envKey: "DODO_TOPUP_PRODUCT_ID_10",
    accent: "from-[#ffd28e]/28 to-transparent",
    caption: "Quick top-up for your next bookings.",
  },
  {
    id: "growth",
    label: "Growth",
    creditsUsd: 25,
    amountUsdCents: 2500,
    envKey: "DODO_TOPUP_PRODUCT_ID_25",
    accent: "from-[#94f0c0]/22 to-transparent",
    caption: "Balanced credit pack for repeat users.",
  },
  {
    id: "pro",
    label: "Pro",
    creditsUsd: 50,
    amountUsdCents: 5000,
    envKey: "DODO_TOPUP_PRODUCT_ID_50",
    accent: "from-[#8ec5ff]/24 to-transparent",
    caption: "Larger reserve for active booking flows.",
  },
];

export function getDodoTopupPack(packId: string) {
  return DODO_TOPUP_PACKS.find((pack) => pack.id === packId) ?? null;
}

export function formatUsdFromCents(amountCents: number) {
  return (amountCents / 100).toFixed(2);
}
