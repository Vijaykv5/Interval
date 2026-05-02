"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "interval-beta-banner-dismissed";

export function BetaBanner() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(localStorage.getItem(STORAGE_KEY) !== "true");
  }, []);

  if (!isVisible) {
    return null;
  }

  function closeBanner() {
    localStorage.setItem(STORAGE_KEY, "true");
    setIsVisible(false);
  }

  return (
    <div className="relative z-20 flex min-h-12 w-full items-center justify-center bg-[#ffd28e] px-12 py-3 text-center text-sm font-semibold text-[#111111] shadow-[0_1px_0_rgba(0,0,0,0.16)] sm:text-base">
      <p className="leading-snug">Interval is currently in beta - thanks for trying it while we keep improving.</p>
      <button
        type="button"
        aria-label="Close beta notice"
        onClick={closeBanner}
        className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#111111] transition hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-black/40"
      >
        <span aria-hidden className="text-2xl leading-none">
          &times;
        </span>
      </button>
    </div>
  );
}
