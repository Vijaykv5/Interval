'use client'
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletAuth } from "@/components/wallet-auth";

type SiteNavProps = {
  minimal?: boolean;
};

export function SiteNav({ minimal = false }: SiteNavProps) {
  const pathname = usePathname();

  const exploreActive = pathname === "/explore" || pathname.startsWith("/explore/");
  const profileActive = pathname === "/profile";

  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 w-full bg-transparent">
      <Link
        href="/"
        className="inline-flex items-center gap-2 shrink-0 py-1 pr-1 rounded transition-opacity hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
      >
        <span
          className="text-lg sm:text-xl font-bold tracking-[0.14em] uppercase text-[#ffd28e] drop-shadow-[0_0_18px_rgba(255,210,142,0.12)]"
          style={{ color: "#ffd28e", fontFamily: "var(--font-archivo-condensed), sans-serif" }}
        >
          INTERVAL
        </span>
        <Image
          src="/favicon.png"
          alt=""
          width={24}
          height={24}
          className="h-5 w-5 sm:h-6 sm:w-6 object-contain flex-shrink-0 opacity-100"
          priority
        />
      </Link>
      <nav className="flex items-center gap-2 sm:gap-3">
        {!minimal && (
          <>
            <Link
              href="/explore"
              className={`hidden sm:inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/40 ${
                exploreActive
                  ? "bg-white/8 text-white"
                  : "text-white/78 hover:bg-white/6 hover:text-white"
              }`}
            >
              Explore
            </Link>
            <Link
              href="/profile"
              className={`hidden sm:inline-flex min-h-10 items-center rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/40 ${
                profileActive
                  ? "bg-white/8 text-white"
                  : "text-white/78 hover:bg-white/6 hover:text-white"
              }`}
            >
              Profile
            </Link>
          </>
        )}
        <WalletAuth variant="landing" unauthenticatedLabel="SIGN IN" />
      </nav>
    </header>
  );
}
