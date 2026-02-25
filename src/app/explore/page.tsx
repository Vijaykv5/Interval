"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getDialBlinkUrl } from "@/lib/constants";

type SlotOption = {
  id: string;
  price: number;
  startTime: string;
  endTime: string;
};

type Creator = {
  id: string;
  username: string;
  wallet: string;
  profileImageUrl: string | null;
  bio: string | null;
  firstAvailableSlot: { id: string; price: number } | null;
  availableSlots: SlotOption[];
};

function formatSlotDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSlotTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Explore() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoverCreator, setHoverCreator] = useState<Creator | null>(null);
  const [modalCreator, setModalCreator] = useState<Creator | null>(null);
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
        // Keep modal in sync if open (so new slots appear without closing modal)
        if (modalCreator) {
          const updated = data.find((c: Creator) => c.id === modalCreator.id);
          if (updated) setModalCreator(updated);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCreators(true);
  }, []);

  // Poll for new slots so newly created slots appear without refresh
  useEffect(() => {
    const interval = setInterval(() => fetchCreators(false), 15_000);
    return () => clearInterval(interval);
  }, [modalCreator]);

  // Refetch when user returns to this tab (e.g. after creating a slot elsewhere)
  useEffect(() => {
    const onFocus = () => fetchCreators(false);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="min-h-screen px-4 sm:px-6 py-8 sm:py-12 text-white">
      <div className="max-w-4xl mx-auto">
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
            <div className="relative flex-1 min-w-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by username or bio..."
                className="w-full pl-10 pr-4 py-3 sm:py-3.5 rounded-xl border border-white/15 bg-white/5 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-white/25 focus:border-white/25 transition-all"
                aria-label="Search creators"
              />
            </div>
            <button
              type="submit"
              className="shrink-0 inline-flex items-center gap-2 px-4 sm:px-5 py-3 sm:py-3.5 rounded-xl font-medium text-white bg-white/15 hover:bg-white/25 border border-white/20 hover:border-white/30 focus:outline-none focus:ring-2 focus:ring-white/25 transition-all active:scale-[0.98]"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <span className="hidden sm:inline">Search</span>
            </button>
          </form>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden animate-pulse"
              >
                <div className="h-40 bg-white/10" />
                <div className="p-4 space-y-2">
                  <div className="h-5 bg-white/10 rounded w-2/3" />
                  <div className="h-4 bg-white/5 rounded w-full" />
                  <div className="h-4 bg-white/5 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-500/20 border border-red-400/40 text-red-200 px-4 py-3">
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
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCreators.map((creator) => (
              <li
                key={creator.id}
                className="relative rounded-2xl border border-white/10 bg-white/5 overflow-hidden hover:border-white/20 hover:bg-white/10 transition-all cursor-pointer"
                onMouseEnter={() => setHoverCreator(creator)}
                onMouseLeave={() => setHoverCreator(null)}
                onClick={() => setModalCreator(creator)}
              >
                {/* Hover popover */}
                {hoverCreator?.id === creator.id && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-56 rounded-xl border border-white/20 bg-black/90 shadow-xl p-3 pointer-events-none backdrop-blur-sm"
                    role="tooltip"
                  >
                    <p className="font-semibold text-white text-sm">
                      @{creator.username}
                    </p>
                    {creator.bio && (
                      <p className="text-xs text-white/70 mt-1 line-clamp-3">
                        {creator.bio}
                      </p>
                    )}
                    <p className="text-xs text-white/50 mt-2">
                      Click to see available slots
                    </p>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full border-8 border-transparent border-t-black/90" />
                  </div>
                )}

                <div className="aspect-square bg-white/5 relative overflow-hidden">
                  {creator.profileImageUrl ? (
                    <img
                      src={creator.profileImageUrl}
                      alt={creator.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-white/40 bg-white/5">
                      {creator.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-white truncate">
                    @{creator.username}
                  </h2>
                  {creator.bio && (
                    <p className="text-sm text-white/70 line-clamp-2 mt-1">
                      {creator.bio}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-white/60">
                    {(creator.availableSlots ?? []).length > 0
                      ? `${(creator.availableSlots ?? []).length} slot${(creator.availableSlots ?? []).length !== 1 ? "s" : ""} available · Click to book`
                      : "No slots available"}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal: available slots */}
      {modalCreator && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setModalCreator(null)}
        >
          <div
            className="bg-[#0d0d0f] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {modalCreator.profileImageUrl ? (
                  <img
                    src={modalCreator.profileImageUrl}
                    alt={modalCreator.username}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-white/10 flex items-center justify-center text-base sm:text-lg font-bold text-white/60 shrink-0">
                    {modalCreator.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <h3 className="font-semibold text-white truncate">
                    @{modalCreator.username}
                  </h3>
                  {modalCreator.bio && (
                    <p className="text-xs sm:text-sm text-white/70 line-clamp-1">
                      {modalCreator.bio}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCreator(null)}
                className="p-2 rounded-lg text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <h4 className="text-sm font-medium text-white/80 mb-3">
                Available slots
              </h4>
              {(modalCreator.availableSlots ?? []).length === 0 ? (
                <p className="text-white/60 text-sm">
                  No slots available right now.
                </p>
              ) : (
                <ul className="space-y-2">
                  {(modalCreator.availableSlots ?? []).map((slot) => (
                    <li key={slot.id}>
                      <a
                        href={getDialBlinkUrl(
                          `${baseUrl}/api/action/book?slotId=${slot.id}`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 hover:bg-white/10 transition-colors"
                      >
                        <p className="font-medium text-white text-sm">
                          {formatSlotDate(slot.startTime)}
                        </p>
                        <p className="text-xs text-white/60 mt-0.5">
                          {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-white">
                          {slot.price % 1 === 0 ? slot.price : slot.price.toFixed(2)} SOL
                        </p>
                        <span className="inline-block mt-2 text-xs font-medium text-white/50">
                          Open blink to book →
                        </span>
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
