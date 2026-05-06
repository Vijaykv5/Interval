import Image from "next/image";
import Link from "next/link";
import { WalletAuth } from "@/components/wallet-auth";

type SiteNavProps = {
  minimal?: boolean;
};

export function SiteNav({ minimal = false }: SiteNavProps) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 w-full bg-transparent">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 shrink-0 py-1 pr-1 rounded transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
      >
        <span
          className="text-lg sm:text-xl font-bold tracking-[0.12em] uppercase"
          style={{ color: "#ffd28e", fontFamily: "var(--font-archivo-condensed), sans-serif" }}
        >
          INTERVAL
        </span>
        <Image
          src="/favicon.png"
          alt=""
          width={24}
          height={24}
          className="h-5 w-5 sm:h-6 sm:w-6 object-contain flex-shrink-0 opacity-95"
          priority
        />
      </Link>
      <nav className="flex items-center gap-3">
        {!minimal && (
          <>
            <Link
              href="/explore"
              className="hidden sm:inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
            >
              Explore
            </Link>
            <Link
              href="/profile"
              className="hidden sm:inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25"
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
