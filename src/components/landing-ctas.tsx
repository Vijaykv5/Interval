"use client";

import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";

export function LandingCtas() {
  const { login } = usePrivy();

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
      <button
        type="button"
        onClick={login}
        className="inline-flex items-center justify-center px-7 py-4 rounded-xl font-semibold transition-all hover:opacity-95 hover:scale-[1.02] border-2 border-transparent shrink-0"
        style={{
          backgroundColor: "#ffd28e",
          color: "#000",
        }}
      >
        <span className="whitespace-nowrap">Are you a creator?</span>
      </button>
      <Link
        href="/explore"
        className="inline-flex items-center justify-center px-7 py-4 rounded-xl font-semibold border-2 transition-all hover:scale-[1.02] hover:opacity-90 shrink-0"
        style={{ borderColor: "#ffd28e", color: "#ffd28e", backgroundColor: "rgba(255, 210, 142, 0.12)" }}
      >
        <span className="whitespace-nowrap">Looking for creators?</span>
      </Link>
    </div>
  );
}
