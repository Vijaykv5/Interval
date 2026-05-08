"use client";

import { startTransition, useState } from "react";
import { useSolanaNetwork } from "@/components/network-provider";
import { type SolanaNetwork } from "@/lib/solana-config";

const OPTIONS: Array<{
  label: string;
  value: SolanaNetwork;
}> = [
  { label: "Devnet", value: "devnet" },
  { label: "Mainnet", value: "mainnet-beta" },
];

export function NetworkToggle() {
  return <NetworkToggleInner variant="compact" />;
}

export function NetworkToggleInner({
  variant = "compact",
}: {
  variant?: "compact" | "sidebar";
}) {
  const { network, setNetwork } = useSolanaNetwork();
  const [switching, setSwitching] = useState(false);

  function handleSelect(nextNetwork: SolanaNetwork) {
    if (nextNetwork === network || switching) {
      return;
    }

    setSwitching(true);
    setNetwork(nextNetwork);

    startTransition(() => {
      window.location.reload();
    });
  }

  const activeIndex = OPTIONS.findIndex((option) => option.value === network);
  const isSidebar = variant === "sidebar";

  return (
    <div className="relative flex">
      <div
        className={`relative overflow-hidden rounded-full border bg-[linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] backdrop-blur-md ${
          isSidebar
            ? "border-[#ffd28e]/22 p-[3px] shadow-[0_10px_22px_rgba(0,0,0,0.18)]"
            : "border-[#ffd28e]/20 p-[3px] shadow-[0_8px_18px_rgba(0,0,0,0.16)]"
        }`}
      >
        <div
          className={`pointer-events-none absolute rounded-full bg-[linear-gradient(135deg,#fffaf2_0%,#ffd28e_48%,#f4a444_100%)] transition-transform duration-300 ease-out ${
            isSidebar
              ? "bottom-[3px] top-[3px] shadow-[0_8px_18px_rgba(255,186,92,0.22)]"
              : "bottom-[3px] top-[3px] shadow-[0_8px_18px_rgba(255,186,92,0.24)]"
          }`}
          style={{
            left: activeIndex === 0 ? "3px" : "calc(50% + 1px)",
            width: "calc(50% - 4px)",
            transform: switching ? "scale(0.98)" : "scale(1)",
          }}
        />
        <div className="relative flex items-center">
          {OPTIONS.map((option) => {
            const active = option.value === network;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                disabled={switching}
                className={`relative inline-flex flex-col items-start justify-center rounded-full text-left transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305] disabled:cursor-wait ${
                  isSidebar
                    ? "min-h-8 min-w-[76px] px-3 py-1.5"
                    : "min-h-8 min-w-[76px] px-3 py-1.5"
                } ${
                  active ? "text-black" : "text-white/78 hover:text-white"
                }`}
              >
                <span
                  className={`font-semibold tracking-[0.04em] ${
                    isSidebar ? "text-[11px]" : "text-[11px]"
                  }`}
                >
                  {switching && active ? "Switching..." : option.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
