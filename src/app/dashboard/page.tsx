"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useWallets } from "@privy-io/react-auth/solana";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  status: string;
  meetLink?: string | null;
};

type Creator = {
  id: string;
  username: string;
  wallet: string;
  profileImageUrl: string | null;
};

type Booking = {
  id: string;
  payerWallet: string;
  amountSol: number;
  name: string | null;
  email: string | null;
  callFor: string | null;
  createdAt: string;
  slot: Slot;
};

type DashboardData = {
  upcomingMeetings: Slot[];
  earnings: number;
  totalBookings: number;
  mySlots: Slot[];
  bookings: Booking[];
  walletBalance: number | null;
};

function formatMeetingDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatMeetingTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Dashboard() {
  const { wallets } = useWallets();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? null;

  const refreshDashboard = useCallback(async (creatorId: string, showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const dashRes = await fetch(
        `/api/dashboard?creatorId=${encodeURIComponent(creatorId)}`
      );
      if (dashRes.ok) {
        const data = await dashRes.json();
        setDashboard({
          ...data,
          mySlots: data.mySlots ?? [],
          bookings: data.bookings ?? [],
          walletBalance: data.walletBalance ?? null,
        });
      }
    } catch {
      // Silently ignore refresh errors to avoid disrupting UX
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      setDashboard({
        upcomingMeetings: [],
        earnings: 0,
        totalBookings: 0,
        mySlots: [],
        bookings: [],
        walletBalance: null,
      });
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const creatorRes = await fetch(
          `/api/creator?wallet=${encodeURIComponent(walletAddress)}`
        );
        if (cancelled || !creatorRes.ok) {
          if (!cancelled) {
            setLoading(false);
            setDashboard({
              upcomingMeetings: [],
              earnings: 0,
              totalBookings: 0,
              mySlots: [],
              bookings: [],
              walletBalance: null,
            });
          }
          return;
        }
        const creatorData = await creatorRes.json();
        if (cancelled) return;
        setCreator(creatorData);

        const dashRes = await fetch(
          `/api/dashboard?creatorId=${encodeURIComponent(creatorData.id)}`
        );
        if (cancelled) return;
        if (dashRes.ok) {
          const data = await dashRes.json();
          setDashboard({
            ...data,
            mySlots: data.mySlots ?? [],
            bookings: data.bookings ?? [],
            walletBalance: data.walletBalance ?? null,
          });
        } else {
          setDashboard({
            upcomingMeetings: [],
            earnings: 0,
            totalBookings: 0,
            mySlots: [],
            bookings: [],
            walletBalance: null,
          });
        }
      } catch {
        if (!cancelled) {
          setDashboard({
            upcomingMeetings: [],
            earnings: 0,
            totalBookings: 0,
            mySlots: [],
            bookings: [],
            walletBalance: null,
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [walletAddress]);

  // Auto-refresh: poll every 5s + refetch when tab becomes visible
  useEffect(() => {
    if (!creator?.id) return;

    const interval = setInterval(() => {
      refreshDashboard(creator.id);
    }, 5000);

    const onFocus = () => refreshDashboard(creator.id);

    window.addEventListener("focus", onFocus);
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [creator?.id, refreshDashboard]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!walletAddress) {
      alert("Connect your wallet first.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/slot/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          startTime,
          endTime,
          price: parseFloat(price),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStartTime("");
        setEndTime("");
        setPrice("");
        const blinkUrl = data.blinkUrl as string | undefined;
        if (blinkUrl) {
          try {
            await navigator.clipboard.writeText(blinkUrl);
            alert(`Slot created! Blink link copied to clipboard.\n\n${blinkUrl}`);
          } catch {
            alert(`Slot created! Copy the blink link below:\n\n${blinkUrl}`);
          }
        } else {
          alert("Slot created!");
        }
        if (creator) {
          await refreshDashboard(creator.id);
        }
      } else {
        alert(data?.error ?? "Failed to create slot");
      }
    } finally {
      setCreating(false);
    }
  }

  const searchParams = useSearchParams();
  const activeSection = (searchParams.get("section") as "overview" | "slots" | "bookings" | "create") || "overview";

  const hasCreator = creator != null;
  const meetings = dashboard?.upcomingMeetings ?? [];
  const mySlots = dashboard?.mySlots ?? [];
  const bookings = dashboard?.bookings ?? [];
  const earnings = dashboard?.earnings ?? 0;
  const totalBookings = dashboard?.totalBookings ?? 0;
  const walletBalance = dashboard?.walletBalance ?? null;

  function slotBlinkUrl(slotId: string) {
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/api/action/book?slotId=${slotId}`;
  }

  async function copyBlink(slotId: string) {
    const url = slotBlinkUrl(slotId);
    try {
      await navigator.clipboard.writeText(url);
      alert("Blink link copied to clipboard!");
    } catch {
      alert(`Copy the link:\n\n${url}`);
    }
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl">
        {!walletAddress && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm">
            Connect your wallet in the sidebar to create slots and see your dashboard.
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-32 rounded-xl bg-gray-100 animate-pulse" />
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-24 rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {activeSection === "overview" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Overview</h2>
                  <p className="text-sm text-gray-500">Your stats at a glance</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Wallet balance</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {walletBalance != null ? (
                        <>{walletBalance.toFixed(4)} <span className="text-base font-semibold text-gray-500">SOL</span></>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total earnings</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {earnings.toFixed(2)} <span className="text-base font-semibold text-gray-500">SOL</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">From {totalBookings} booking{totalBookings !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Upcoming meetings</p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">{meetings.length}</p>
                  </div>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">Upcoming meetings</h3>
                  {meetings.length === 0 ? (
                    <p className="text-sm text-gray-500">No upcoming booked meetings.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {meetings.map((slot) => (
                        <li key={slot.id} className="py-3 first:pt-0 flex items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">{formatMeetingDate(slot.startTime)}</p>
                            <p className="text-sm text-gray-500">{formatMeetingTime(slot.startTime)} – {formatMeetingTime(slot.endTime)}</p>
                          </div>
                          {slot.meetLink && (
                            <a href={slot.meetLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 font-medium shrink-0">
                              Join →
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeSection === "slots" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">My slots</h2>
                  <p className="text-sm text-gray-500">Slots you created; share the blink link to get booked</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  {mySlots.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                      <p className="font-medium text-gray-700">No slots yet</p>
                      <p className="text-sm mt-1">Create a slot to get a Solana blink link for booking.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {mySlots.map((slot) => (
                        <li key={slot.id} className="p-5 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-gray-900">{formatMeetingDate(slot.startTime)}</p>
                            <p className="text-sm text-gray-500">
                              {formatMeetingTime(slot.startTime)} – {formatMeetingTime(slot.endTime)} · {Number(slot.price).toFixed(2)} SOL
                            </p>
                            {slot.meetLink && (
                              <a href={slot.meetLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 mt-1 inline-block">
                                Join meeting →
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {slot.status === "available" ? (
                              <>
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">Available</span>
                                <button type="button" onClick={() => copyBlink(slot.id)} className="text-sm font-medium text-gray-700 hover:text-gray-900 underline">
                                  Copy blink link
                                </button>
                              </>
                            ) : (
                              <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">Booked</span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeSection === "bookings" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Payments & bookings</h2>
                  <p className="text-sm text-gray-500">Payments received when someone books via your blink</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
                  {bookings.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                      <p className="font-medium text-gray-700">No bookings yet</p>
                      <p className="text-sm mt-1">Share your blink link to receive bookings and payments.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {bookings.map((b) => (
                        <li key={b.id} className="p-5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-medium text-gray-900">{formatMeetingDate(b.slot.startTime)} · {Number(b.amountSol).toFixed(2)} SOL</p>
                            <span className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">Paid</span>
                          </div>
                          <p className="text-sm text-gray-600">Slot: {formatMeetingTime(b.slot.startTime)} – {formatMeetingTime(b.slot.endTime)}</p>
                          {b.slot.meetLink && (
                            <a href={b.slot.meetLink} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:text-blue-700 inline-block">
                              Join meeting →
                            </a>
                          )}
                          <p className="text-xs font-mono text-gray-500 truncate" title={b.payerWallet}>From: {b.payerWallet}</p>
                          {(b.name || b.email || b.callFor) && (
                            <div className="text-sm text-gray-600 pt-2 border-t border-gray-100">
                              {b.name && <p><span className="text-gray-500">Name:</span> {b.name}</p>}
                              {b.email && <p><span className="text-gray-500">Email:</span> {b.email}</p>}
                              {b.callFor && <p><span className="text-gray-500">Purpose:</span> {b.callFor}</p>}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {activeSection === "create" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-1">Create slot</h2>
                  <p className="text-sm text-gray-500">Add a time slot and get a blink link to share</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-6 md:p-8 shadow-sm max-w-lg">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1.5">Start time</label>
                      <input
                        id="startTime"
                        type="datetime-local"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1.5">End time</label>
                      <input
                        id="endTime"
                        type="datetime-local"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-1.5">Price (SOL)</label>
                      <input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full sm:w-auto bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
                    >
                      {creating ? "Creating…" : "Create slot"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </>
        )}
    </div>
  );
}
