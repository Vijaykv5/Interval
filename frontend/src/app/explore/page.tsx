"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SiteNav } from "@/components/site-nav";

type SlotOption = {
  id: string;
  price: number;
  currency: "SOL" | "PUSD" | "USDC";
  startTime: string;
  endTime: string;
};

type Creator = {
  id: string;
  username: string;
  wallet: string;
  profileImageUrl: string | null;
  bio: string | null;
  xAccount?: string | null;
  launchedTokenMint?: string | null;
  launchedTokenName?: string | null;
  launchedTokenSymbol?: string | null;
  launchedTokenUrl?: string | null;
  launchedTokenAt?: string | null;
  firstAvailableSlot: { id: string; price: number; currency: "SOL" | "PUSD" | "USDC" } | null;
  availableSlots: SlotOption[];
};

export default function Explore() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverCreator, setHoverCreator] = useState<Creator | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredCreators = creators.filter((c) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.username.toLowerCase().includes(q) ||
      (c.bio?.toLowerCase().includes(q) ?? false)
    );
  });

  const fetchCreators = (showLoading = false) => {
    if (showLoading) setLoading(true);
    fetch("/api/creators")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load creators");
        return res.json();
      })
      .then((data) => {
        setCreators(data);
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      fetchCreators(false);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  // Poll for new slots so newly created slots appear without refresh
  useEffect(() => {
    const interval = setInterval(() => fetchCreators(false), 15_000);
    return () => clearInterval(interval);
  }, []);

  // Refetch when user returns to this tab (e.g. after creating a slot elsewhere)
  useEffect(() => {
    const onFocus = () => fetchCreators(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <SiteNav />
      </div>

      <div className="px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8 sm:mb-10">
          <Link
            href="/"
            className="text-white/70 hover:text-white font-medium inline-flex items-center gap-1 mb-4 sm:mb-6 transition-colors"
          >
            ← Back to home
          </Link>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white">
            Connect with creators
          </h1>
          <p className="text-white/70 mt-2 text-sm sm:text-base">
            Browse creators and book a slot.
          </p>
        </div>

        {/* Search bar */}
          <div className="mb-6 sm:mb-8">
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex gap-2 sm:gap-3"
            >
              <div className="relative min-w-0 flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/40">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by username or bio..."
                  className="w-full rounded-xl border border-white/15 bg-white/5 py-3 pl-10 pr-4 text-white placeholder:text-white/40 transition-all focus:border-white/25 focus:outline-none focus:ring-2 focus:ring-white/25"
                  aria-label="Search creators"
                />
              </div>
              <button
                type="submit"
                className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-4 py-3 font-medium text-white transition-all hover:border-white/30 hover:bg-white/25 focus:outline-none focus:ring-2 focus:ring-white/25 active:scale-[0.98] sm:px-5 sm:py-3.5"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="hidden sm:inline">Search</span>
              </button>
            </form>
          </div>

          {loading && (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 animate-pulse"
                >
                  <div className="h-40 bg-white/10" />
                  <div className="space-y-2 p-4">
                    <div className="h-5 w-2/3 rounded bg-white/10" />
                    <div className="h-4 w-full rounded bg-white/5" />
                    <div className="h-4 w-4/5 rounded bg-white/5" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-400/40 bg-red-500/20 px-4 py-3 text-red-200">
              {error}
            </div>
          )}

          {!loading && !error && creators.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
              No creators yet. Be the first to create a slot from the dashboard.
            </div>
          )}

          {!loading && !error && creators.length > 0 && filteredCreators.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-12 text-center text-white/70">
              No creators match &quot;{searchQuery.trim()}&quot;. Try a different search.
            </div>
          )}

          {!loading && !error && filteredCreators.length > 0 && (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCreators.map((creator) => (
                <li
                  key={creator.id}
                  className="relative"
                  onMouseEnter={() => setHoverCreator(creator)}
                  onMouseLeave={() => setHoverCreator(null)}
                >
                  {hoverCreator?.id === creator.id && (
                    <div
                      className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-56 -translate-x-1/2 rounded-xl border border-white/20 bg-black/90 p-3 shadow-xl backdrop-blur-sm"
                      role="tooltip"
                    >
                      <p className="text-sm font-semibold text-white">
                        @{creator.username}
                      </p>
                      {creator.bio && (
                        <p className="mt-1 line-clamp-3 text-xs text-white/70">
                          {creator.bio}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-white/50">
                        Click to see available slots
                      </p>
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-8 border-transparent border-t-black/90" />
                    </div>
                  )}

                  <Link
                    href={`/explore/${encodeURIComponent(creator.username)}`}
                    className="block overflow-hidden rounded-2xl border border-white/10 bg-white/5 transition-all hover:border-white/20 hover:bg-white/10"
                  >
                    <div className="relative aspect-square overflow-hidden bg-white/5">
                      {creator.profileImageUrl ? (
                        <img
                          src={creator.profileImageUrl}
                          alt={creator.username}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-white/5 text-4xl font-bold text-white/40">
                          {creator.username.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <h2 className="truncate font-semibold text-white">
                        @{creator.username}
                      </h2>
                      {creator.bio && (
                        <p className="mt-1 line-clamp-2 text-sm text-white/70">
                          {creator.bio}
                        </p>
                      )}
                      <p className="mt-3 text-sm text-white/60">
                        {(creator.availableSlots ?? []).length > 0
                          ? `${(creator.availableSlots ?? []).length} slot${(creator.availableSlots ?? []).length !== 1 ? "s" : ""} available · Open creator page`
                          : "No slots available"}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
