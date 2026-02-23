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

  useEffect(() => {
    fetch("/api/creators")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load creators");
        return res.json();
      })
      .then(setCreators)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const baseUrl =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL ?? "";

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-10">
          <Link
            href="/"
            className="text-gray-700 hover:text-gray-900 font-medium inline-flex items-center gap-1 mb-6"
          >
            ← Back to home
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            Connect with creators
          </h1>
          <p className="text-gray-600 mt-2">
            Browse creators and book a slot.
          </p>
        </div>

        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-gray-200 bg-white/80 shadow-sm overflow-hidden animate-pulse"
              >
                <div className="h-40 bg-gray-200" />
                <div className="p-4 space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-2/3" />
                  <div className="h-4 bg-gray-100 rounded w-full" />
                  <div className="h-4 bg-gray-100 rounded w-4/5" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 text-red-800 px-4 py-3">
            {error}
          </div>
        )}

        {!loading && !error && creators.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white/80 shadow-sm p-12 text-center text-gray-600">
            No creators yet. Be the first to create a slot from the dashboard.
          </div>
        )}

        {!loading && !error && creators.length > 0 && (
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {creators.map((creator) => (
              <li
                key={creator.id}
                className="relative rounded-2xl border border-gray-200 bg-white/80 shadow-sm overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onMouseEnter={() => setHoverCreator(creator)}
                onMouseLeave={() => setHoverCreator(null)}
                onClick={() => setModalCreator(creator)}
              >
                {/* Hover popover */}
                {hoverCreator?.id === creator.id && (
                  <div
                    className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-10 w-56 rounded-xl border border-gray-200 bg-white shadow-lg p-3 pointer-events-none"
                    role="tooltip"
                  >
                    <p className="font-semibold text-gray-900 text-sm">
                      @{creator.username}
                    </p>
                    {creator.bio && (
                      <p className="text-xs text-gray-600 mt-1 line-clamp-3">
                        {creator.bio}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Click to see available slots
                    </p>
                    <div className="absolute left-1/2 -translate-x-1/2 top-full border-8 border-transparent border-t-white" />
                  </div>
                )}

                <div className="aspect-square bg-gray-100 relative overflow-hidden">
                  {creator.profileImageUrl ? (
                    <img
                      src={creator.profileImageUrl}
                      alt={creator.username}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-300 bg-linear-to-br from-gray-100 to-gray-200">
                      {creator.username.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <h2 className="font-semibold text-gray-900 truncate">
                    @{creator.username}
                  </h2>
                  {creator.bio && (
                    <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                      {creator.bio}
                    </p>
                  )}
                  <p className="mt-3 text-sm text-gray-500">
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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setModalCreator(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {modalCreator.profileImageUrl ? (
                  <img
                    src={modalCreator.profileImageUrl}
                    alt={modalCreator.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-lg font-bold text-gray-500">
                    {modalCreator.username.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">
                    @{modalCreator.username}
                  </h3>
                  {modalCreator.bio && (
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {modalCreator.bio}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalCreator(null)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 overflow-y-auto flex-1">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Available slots
              </h4>
              {(modalCreator.availableSlots ?? []).length === 0 ? (
                <p className="text-gray-500 text-sm">
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
                        className="block rounded-xl border border-gray-200 p-4 hover:border-gray-900 hover:bg-gray-50 transition-colors"
                      >
                        <p className="font-medium text-gray-900 text-sm">
                          {formatSlotDate(slot.startTime)}
                        </p>
                        <p className="text-xs text-gray-600 mt-0.5">
                          {formatSlotTime(slot.startTime)} – {formatSlotTime(slot.endTime)}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-gray-900">
                          {slot.price % 1 === 0 ? slot.price : slot.price.toFixed(2)} SOL
                        </p>
                        <span className="inline-block mt-2 text-xs font-medium text-gray-600">
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
