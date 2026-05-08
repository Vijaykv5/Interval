"use client";

import { useRouter } from "next/navigation";

export function LandingCtas() {
  const router = useRouter();

  function routeCreator() {
    router.push("/explore");
  }

  function routeUser() {
    router.push("/explore");
  }

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
      <button
        type="button"
        onClick={routeCreator}
        className="inline-flex min-h-12 items-center justify-center px-7 py-4 rounded-xl font-semibold transition-all hover:opacity-95 hover:scale-[1.02] border-2 border-transparent shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{
          backgroundColor: "#ffd28e",
          color: "#000",
        }}
      >
        <span className="whitespace-nowrap">Are you a creator?</span>
      </button>

      <button
        type="button"
        onClick={routeUser}
        className="inline-flex min-h-12 items-center justify-center px-7 py-4 rounded-xl font-semibold border-2 transition-all hover:scale-[1.02] hover:opacity-90 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
        style={{ borderColor: "#ffd28e", color: "#ffd28e", backgroundColor: "rgba(255, 210, 142, 0.12)" }}
      >
        <span className="whitespace-nowrap">Looking for creators?</span>
      </button>
    </div>
  );
}
