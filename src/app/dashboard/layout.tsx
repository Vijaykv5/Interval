"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets } from "@privy-io/react-auth/solana";
import { WalletAuth } from "@/components/wallet-auth";
import { OnboardingModal } from "@/components/onboarding-modal";

const dashboardSections = [
  { section: "overview", label: "Overview" },
  { section: "slots", label: "My slots" },
  { section: "bookings", label: "Payments & bookings" },
  { section: "create", label: "Create slot" },
];

function NavLinks({
  pathname,
  currentSection,
  onNavigate,
}: {
  pathname: string;
  currentSection: string | null;
  onNavigate?: () => void;
}) {
  return (
    <>
      {dashboardSections.map(({ section, label }) => {
        const href = `/dashboard${section === "overview" ? "" : `?section=${section}`}`;
        const isActive = pathname === "/dashboard" && currentSection === section;
        return (
          <Link
            key={section}
            href={href}
            onClick={onNavigate}
            className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              isActive
                ? "bg-white/10 text-white border-l-2 pl-[14px]"
                : "text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4"
            }`}
            style={isActive ? { borderLeftColor: "#ffd28e" } : undefined}
          >
            {label}
          </Link>
        );
      })}
      <Link
        href="/dashboard/onboarding"
        onClick={onNavigate}
        className={`block px-4 py-3 rounded-xl text-sm font-medium transition-all mt-2 ${
          pathname === "/dashboard/onboarding"
            ? "bg-white/10 text-white border-l-2 pl-[14px]"
            : "text-white/70 hover:bg-white/5 hover:text-white border-l-2 border-transparent pl-4"
        }`}
        style={pathname === "/dashboard/onboarding" ? { borderLeftColor: "#ffd28e" } : undefined}
      >
        Profile
      </Link>
    </>
  );
}

function DashboardLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSection = pathname === "/dashboard" ? (searchParams.get("section") ?? "overview") : null;
  const { ready, authenticated } = usePrivy();
  const { wallets } = useWallets();
  const [authChecked, setAuthChecked] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? null;
  const isOnboardingPage = pathname === "/dashboard/onboarding";

  useEffect(() => {
    if (!ready) return;

    if (!authenticated) {
      router.replace("/");
      return;
    }

    if (isOnboardingPage) {
      setAuthChecked(true);
      return;
    }

    if (!walletAddress) {
      setAuthChecked(true);
      return;
    }

    let cancelled = false;
    async function ensureCreator() {
      try {
        const res = await fetch(
          `/api/creator?wallet=${encodeURIComponent(walletAddress)}`
        );
        if (cancelled) return;
        if (!res.ok) {
          setShowOnboardingModal(true);
          setAuthChecked(true);
          return;
        }
      } catch {
        if (!cancelled) {
          setShowOnboardingModal(true);
          setAuthChecked(true);
        }
        return;
      }
      setAuthChecked(true);
    }
    ensureCreator();
    return () => {
      cancelled = true;
    };
  }, [ready, authenticated, walletAddress, isOnboardingPage, router]);

  if (!ready || (!isOnboardingPage && !authChecked)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030305]">
        <div className="text-white/60">Loading…</div>
      </div>
    );
  }

  if (!authenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen bg-[#030305]">
      {/* Mobile top bar — visible only on small screens */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-30 flex items-center justify-between px-4 py-3 border-b border-white/10 bg-[#030305]/95 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-white/80 hover:bg-white/10 hover:text-white transition-colors"
          aria-label="Open menu"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/dashboard" className="font-semibold text-lg tracking-tight" style={{ color: "#ffd28e" }}>
          Interval
        </Link>
        <div className="w-20 flex justify-end">
          <WalletAuth variant="landing" />
        </div>
      </header>

      {/* Mobile drawer overlay + panel */}
      {mobileMenuOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            aria-hidden
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 max-w-[85vw] flex flex-col border-r border-white/10 bg-[#0a0a0d] shadow-2xl animate-[slideInLeft_0.2s_ease-out]">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <span className="font-semibold text-lg tracking-tight" style={{ color: "#ffd28e" }}>Menu</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              <NavLinks pathname={pathname} currentSection={currentSection} onNavigate={() => setMobileMenuOpen(false)} />
            </nav>
            <div className="p-3 border-t border-white/10">
              <WalletAuth variant="sidebar" />
            </div>
          </aside>
        </>
      )}

      {/* Sidebar — hidden on mobile, visible from md (desktop unchanged) */}
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-white/10 bg-gradient-to-b from-black/60 to-black/40">
        <div className="p-5 border-b border-white/10">
          <Link href="/dashboard" className="font-semibold text-xl tracking-tight" style={{ color: "#ffd28e" }}>
            Interval
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          <NavLinks pathname={pathname} currentSection={currentSection} />
        </nav>
        <div className="p-3 border-t border-white/10">
          <WalletAuth variant="sidebar" />
        </div>
      </aside>

      {/* Main content — subtle gradient for depth; pt for mobile top bar */}
      <main className="flex-1 overflow-auto bg-gradient-to-br from-[#030305] via-[#0a0a0d] to-[#030305] pt-14 md:pt-0">
        {children}
      </main>
      {showOnboardingModal && walletAddress && (
        <OnboardingModal
          open={showOnboardingModal}
          walletAddress={walletAddress}
          closable={false}
          onSuccess={() => {
            setShowOnboardingModal(false);
            router.replace("/dashboard");
          }}
          onClose={() => {
            setShowOnboardingModal(false);
            router.replace("/dashboard/onboarding");
          }}
        />
      )}
    </div>
  );
}

function DashboardLayoutFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#030305]">
      <div className="text-white/60">Loading…</div>
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardLayoutFallback />}>
      <DashboardLayoutClient>{children}</DashboardLayoutClient>
    </Suspense>
  );
}
