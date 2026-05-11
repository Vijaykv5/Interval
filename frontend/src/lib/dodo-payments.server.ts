import DodoPayments from "dodopayments";
import {
  formatUsdFromCents,
  getDodoTopupPack,
  type DodoTopupPack,
} from "@/lib/dodo-topup-packs";

export { formatUsdFromCents, getDodoTopupPack };
export type { DodoTopupPack };

export function getDodoMode() {
  return process.env.NEXT_PUBLIC_DODO_PAYMENTS_MODE === "live" ||
    process.env.DODO_PAYMENTS_MODE === "live"
    ? "live"
    : "test";
}

export function getDodoTopupProductId(pack: DodoTopupPack) {
  return process.env[pack.envKey]?.trim() ?? null;
}

export function createDodoClient() {
  const bearerToken =
    process.env.DODO_PAYMENTS_API_KEY?.trim() ||
    process.env.DODO_API_KEY?.trim();

  if (!bearerToken) {
    throw new Error("DODO_PAYMENTS_API_KEY or DODO_API_KEY is not configured.");
  }

  return new DodoPayments({
    bearerToken,
    webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY?.trim() ?? undefined,
    environment: getDodoMode() === "live" ? "live_mode" : "test_mode",
  });
}
