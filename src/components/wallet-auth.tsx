"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";

function shortenAddress(address: string) {
  if (!address || address.length < 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

type WalletAuthProps = {
  variant?: "header" | "sidebar" | "landing";
  /** When set, used as the button label when not authenticated (e.g. "SIGN IN") */
  unauthenticatedLabel?: string;
};

export function WalletAuth({ variant = "header", unauthenticatedLabel }: WalletAuthProps) {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallets } = useWallets();

  const solanaWallet = wallets[0];
  const address = solanaWallet?.address ?? null;

  const isSidebar = variant === "sidebar";
  const isLanding = variant === "landing";
  const wrapperClass = isSidebar
    ? "p-3"
    : isLanding
      ? ""
      : "absolute top-4 right-4";

  if (!ready) {
    return (
      <div className={`${wrapperClass} px-3 py-1.5 text-sm ${isLanding ? "text-white/60" : "text-gray-500"}`}>
        Loading…
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className={wrapperClass}>
        <button
          type="button"
          onClick={login}
          className={
            isLanding
              ? "px-5 py-2.5 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black hover:opacity-90"
              : "w-full px-4 py-2 rounded-lg bg-gray-100 border border-gray-300 text-gray-800 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          }
          style={isLanding ? { backgroundColor: "#ffd28e", color: "#000" } : undefined}
        >
          {unauthenticatedLabel ?? "Connect Wallet"}
        </button>
      </div>
    );
  }

  return (
    <div className={`${wrapperClass} flex flex-col gap-2 ${!isSidebar ? "flex-row items-center gap-3" : ""}`}>
      {address && (
        <span
          className={`px-3 py-1.5 rounded-lg text-sm font-mono truncate ${
            isLanding
              ? "bg-white/10 text-white/90 border border-white/20"
              : "bg-gray-50 border border-gray-200 text-gray-700"
          }`}
        >
          {shortenAddress(address)}
        </span>
      )}
      <button
        type="button"
        onClick={logout}
        className={`text-sm underline text-left ${isLanding ? "text-white/60 hover:text-white" : "text-gray-500 hover:text-gray-900"}`}
      >
        Log out
      </button>
    </div>
  );
}
