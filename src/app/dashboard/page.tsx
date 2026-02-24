"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useWallets } from "@privy-io/react-auth/solana";
import { toast } from "sonner";
import { getDialBlinkUrl } from "@/lib/constants";

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

/** Returns YYYY-MM-DD for today (local) */
function todayLocal(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DDTHH:mm for now, rounded up to next 15 min (local) */
function nowRoundedUp15(): string {
  const d = new Date();
  const mins = d.getMinutes();
  const rounded = Math.ceil(mins / 15) * 15;
  d.setMinutes(rounded === 60 ? 0 : rounded);
  if (rounded === 60) d.setHours(d.getHours() + 1);
  d.setSeconds(0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

/** Add minutes to a datetime-local string (YYYY-MM-DDTHH:mm), return same format */
function addMinutesToDatetimeLocal(dt: string, minutes: number): string {
  const d = new Date(dt);
  d.setMinutes(d.getMinutes() + minutes);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day}T${h}:${min}`;
}

export default function Dashboard() {
  const { wallets } = useWallets();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);

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
    setCreateError(null);
    if (!walletAddress) {
      setCreateError("Connect your wallet first.");
      return;
    }
    const start = startTime.trim();
    const end = endTime.trim();
    const priceNum = parseFloat(price);
    if (!start) {
      setCreateError("Please pick a start date and time.");
      return;
    }
    if (!end) {
      setCreateError("Please pick an end date and time, or use a duration (15 min, 30 min, 1 hour).");
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (endDate.getTime() <= startDate.getTime()) {
      setCreateError("End time must be after start time.");
      return;
    }
    if (Number.isNaN(priceNum) || priceNum < 0) {
      setCreateError("Please enter a valid price (0 or more SOL).");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/slot/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          startTime: startDate.toISOString(),
          endTime: endDate.toISOString(),
          price: priceNum,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setStartTime("");
        setEndTime("");
        setPrice("");
        setCreateError(null);
        const blinkUrl = data.blinkUrl as string | undefined;
        if (blinkUrl) {
          const dialUrl = getDialBlinkUrl(blinkUrl);
          try {
            await navigator.clipboard.writeText(dialUrl);
            toast.success("Slot created! Blink link copied to clipboard.", {
              description: dialUrl,
            });
          } catch {
            toast.success("Slot created! Copy the blink link below.", {
              description: dialUrl,
            });
          }
        } else {
          toast.success("Slot created!");
        }
        if (creator) {
          await refreshDashboard(creator.id);
        }
      } else {
        setCreateError(data?.error ?? "Failed to create slot");
      }
    } catch {
      setCreateError("Something went wrong. Please try again.");
    } finally {
      setCreating(false);
    }
  }

  function applyDuration(minutes: 15 | 30 | 60) {
    if (startTime) {
      setEndTime(addMinutesToDatetimeLocal(startTime, minutes));
      setCreateError(null);
    } else {
      const start = nowRoundedUp15();
      setStartTime(start);
      setEndTime(addMinutesToDatetimeLocal(start, minutes));
      setCreateError(null);
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

  function dialBlinkUrl(slotId: string) {
    return getDialBlinkUrl(slotBlinkUrl(slotId));
  }

  async function copyBlink(slotId: string) {
    const url = dialBlinkUrl(slotId);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Blink link copied to clipboard!");
    } catch {
      toast.success("Copy the link", { description: url });
    }
  }

  return (
    <div className="p-6 md:p-10 w-full text-white">
        {!walletAddress && (
          <div className="mb-6 p-4 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-200 text-sm">
            Connect your wallet in the sidebar to create slots and see your dashboard.
          </div>
        )}

        {loading ? (
          <div className="space-y-6">
            <div className="h-8 w-48 rounded-lg bg-white/10 animate-pulse" />
            <div className="grid gap-5 sm:grid-cols-3">
              <div className="h-28 rounded-2xl bg-white/10 animate-pulse" />
              <div className="h-28 rounded-2xl bg-white/10 animate-pulse" />
              <div className="h-28 rounded-2xl bg-white/10 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {activeSection === "overview" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Overview</h2>
                  <p className="text-sm text-white/50 mt-1">Your stats at a glance</p>
                </div>
                <div className="grid gap-5 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-6 overflow-hidden relative group hover:border-white/15 transition-colors">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd28e]/50 to-transparent opacity-80" />
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Wallet balance</p>
                    <p className="mt-3 text-2xl font-bold text-white tabular-nums">
                      {walletBalance != null ? (
                        <>{walletBalance.toFixed(4)} <span className="text-lg font-semibold" style={{ color: "#ffd28e" }}>SOL</span></>
                      ) : (
                        <span className="text-white/40">—</span>
                      )}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-6 overflow-hidden relative group hover:border-white/15 transition-colors">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd28e]/50 to-transparent opacity-80" />
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Total earnings</p>
                    <p className="mt-3 text-2xl font-bold text-white tabular-nums">
                      {earnings.toFixed(2)} <span className="text-lg font-semibold" style={{ color: "#ffd28e" }}>SOL</span>
                    </p>
                    <p className="text-xs text-white/45 mt-1">From {totalBookings} booking{totalBookings !== 1 ? "s" : ""}</p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm p-6 overflow-hidden relative group hover:border-white/15 transition-colors">
                    <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd28e]/50 to-transparent opacity-80" />
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest">Upcoming meetings</p>
                    <p className="mt-3 text-2xl font-bold text-white tabular-nums">{meetings.length}</p>
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm overflow-hidden">
                  <div className="p-5 border-b border-white/10">
                    <h3 className="text-base font-semibold text-white">Upcoming meetings</h3>
                  </div>
                  <div className="p-6">
                    {meetings.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-white/50 text-sm">No upcoming booked meetings.</p>
                        <p className="text-white/35 text-xs mt-1">When someone books a slot, it will show here.</p>
                        <Link
                          href="/dashboard?section=create"
                          className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-medium text-black hover:opacity-90 transition-opacity"
                          style={{ backgroundColor: "#ffd28e" }}
                        >
                          Create a slot
                        </Link>
                      </div>
                    ) : (
                      <ul className="divide-y divide-white/10">
                        {meetings.map((slot) => (
                          <li key={slot.id} className="py-4 first:pt-0 flex items-center justify-between gap-4">
                            <div>
                              <p className="font-medium text-white">{formatMeetingDate(slot.startTime)}</p>
                              <p className="text-sm text-white/50">{formatMeetingTime(slot.startTime)} – {formatMeetingTime(slot.endTime)}</p>
                            </div>
                            {slot.meetLink && (
                              <a href={slot.meetLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium shrink-0 hover:opacity-90 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 transition-colors" style={{ color: "#ffd28e" }}>
                                Join →
                              </a>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeSection === "slots" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">My slots</h2>
                  <p className="text-sm text-white/50 mt-1">Slots you created; share the blink link to get booked</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm overflow-hidden">
                  {mySlots.length === 0 ? (
                    <div className="p-12 text-center text-white/50">
                      <p className="font-medium text-white/80">No slots yet</p>
                      <p className="text-sm mt-1">Create a slot to get a Solana blink link for booking.</p>
                      <Link href="/dashboard?section=create" className="inline-block mt-4 px-4 py-2 rounded-xl text-sm font-medium text-black" style={{ backgroundColor: "#ffd28e" }}>Create slot</Link>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/10">
                      {mySlots.map((slot) => (
                        <li key={slot.id} className="p-6 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <p className="font-medium text-white">{formatMeetingDate(slot.startTime)}</p>
                            <p className="text-sm text-white/60">
                              {formatMeetingTime(slot.startTime)} – {formatMeetingTime(slot.endTime)} · <span style={{ color: "#ffd28e" }}>{Number(slot.price).toFixed(2)} SOL</span>
                            </p>
                            {slot.meetLink && (
                              <a href={slot.meetLink} target="_blank" rel="noopener noreferrer" className="text-sm mt-1 inline-block hover:opacity-90" style={{ color: "#ffd28e" }}>
                                Join meeting →
                              </a>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {slot.status === "available" ? (
                              <>
                                <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">Available</span>
                                <a
                                  href={dialBlinkUrl(slot.id)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-white/80 hover:text-white underline"
                                  style={{ color: "#ffd28e" }}
                                >
                                  Open blink to book →
                                </a>
                                <button type="button" onClick={() => copyBlink(slot.id)} className="text-sm font-medium text-white/60 hover:text-white underline">
                                  Copy link
                                </button>
                              </>
                            ) : (
                              <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">Booked</span>
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
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Payments & bookings</h2>
                  <p className="text-sm text-white/50 mt-1">Payments received when someone books via your blink</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm overflow-hidden">
                  {bookings.length === 0 ? (
                    <div className="p-12 text-center text-white/50">
                      <p className="font-medium text-white/80">No bookings yet</p>
                      <p className="text-sm mt-1">Share your blink link to receive bookings and payments.</p>
                    </div>
                  ) : (
                    <ul className="divide-y divide-white/10">
                      {bookings.map((b) => (
                        <li
                          key={b.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedBooking(b)}
                          onKeyDown={(e) => e.key === "Enter" && setSelectedBooking(b)}
                          className="p-5 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-white/5 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <p className="font-medium text-white">{formatMeetingDate(b.slot.startTime)}</p>
                            <p className="text-sm" style={{ color: "#ffd28e" }}>{Number(b.amountSol).toFixed(2)} SOL</p>
                          </div>
                          <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90">Paid</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* Booking detail slide-over panel */}
            {selectedBooking && (
              <>
                <div
                  className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
                  style={{ animation: "fadeIn 0.25s ease-out" }}
                  aria-hidden
                  onClick={() => setSelectedBooking(null)}
                />
                <div
                  className="fixed top-0 right-0 bottom-0 w-full max-w-md bg-[#0d0d0f] border-l border-white/10 shadow-2xl z-50 flex flex-col"
                  style={{ animation: "slideInFromRight 0.3s ease-out" }}
                >
                  <style>{`@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideInFromRight{from{transform:translateX(100%);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
                  <div className="p-5 border-b border-white/10 flex items-center justify-between shrink-0">
                    <h3 className="text-lg font-semibold text-white">Booking details</h3>
                    <button
                      type="button"
                      onClick={() => setSelectedBooking(null)}
                      className="p-2 rounded-lg text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-5 overflow-y-auto flex-1 space-y-4">
                    <div>
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Date & amount</p>
                      <p className="text-white">{formatMeetingDate(selectedBooking.slot.startTime)} · <span style={{ color: "#ffd28e" }}>{Number(selectedBooking.amountSol).toFixed(2)} SOL</span></p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Slot</p>
                      <p className="text-white/90">{formatMeetingTime(selectedBooking.slot.startTime)} – {formatMeetingTime(selectedBooking.slot.endTime)}</p>
                    </div>
                    {selectedBooking.slot.meetLink && (
                      <a
                        href={selectedBooking.slot.meetLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block px-4 py-2 rounded-xl text-sm font-medium text-black hover:opacity-90"
                        style={{ backgroundColor: "#ffd28e" }}
                      >
                        Join meeting →
                      </a>
                    )}
                    <div>
                      <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">From</p>
                      <p className="text-sm font-mono text-white/80 break-all">{selectedBooking.payerWallet}</p>
                    </div>
                    {selectedBooking.name && (
                      <div>
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Name</p>
                        <p className="text-white/90">{selectedBooking.name}</p>
                      </div>
                    )}
                    {selectedBooking.email && (
                      <div>
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Email</p>
                        <p className="text-white/90">{selectedBooking.email}</p>
                      </div>
                    )}
                    {selectedBooking.callFor && (
                      <div>
                        <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-1">Purpose</p>
                        <p className="text-white/90">{selectedBooking.callFor}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeSection === "create" && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Create slot</h2>
                  <p className="text-sm text-white/50 mt-1">Add a time slot and get a blink link to share with anyone.</p>
                </div>
                <div className="relative rounded-2xl border border-white/10 bg-white/[0.06] backdrop-blur-sm overflow-hidden max-w-lg">
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-[#ffd28e]/50 to-transparent opacity-80" />
                  <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                    {createError && (
                      <div className="rounded-xl bg-red-500/15 border border-red-400/30 px-4 py-3 text-sm text-red-200 flex items-start gap-2">
                        <span className="shrink-0 mt-0.5" aria-hidden>⚠</span>
                        <span>{createError}</span>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label htmlFor="startTime" className="block text-sm font-medium text-white/90">Start date & time</label>
                      <input
                        id="startTime"
                        type="datetime-local"
                        value={startTime}
                        min={todayLocal() + "T00:00"}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setCreateError(null);
                        }}
                        className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ffd28e]/50 focus:border-[#ffd28e]/40 transition-colors [color-scheme:dark]"
                      />
                      <p className="text-xs text-white/40">When your slot begins</p>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-white/90">Duration</label>
                      <div className="flex flex-wrap gap-2">
                        {([15, 30, 60] as const).map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => applyDuration(mins)}
                            className="px-5 py-3 rounded-xl border border-white/20 bg-white/5 text-white/90 hover:bg-white/10 hover:border-[#ffd28e]/30 hover:text-white transition-all text-sm font-medium min-w-[4.5rem]"
                          >
                            {mins === 60 ? "1 hour" : `${mins} min`}
                          </button>
                        ))}
                      </div>
                      <p className="text-xs text-white/40">Sets end time from start</p>
                    </div>
                    <div className="space-y-2">
                      <label htmlFor="endTime" className="block text-sm font-medium text-white/90">End date & time</label>
                      <input
                        id="endTime"
                        type="datetime-local"
                        value={endTime}
                        min={startTime || todayLocal() + "T00:00"}
                        onChange={(e) => {
                          setEndTime(e.target.value);
                          setCreateError(null);
                        }}
                        className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ffd28e]/50 focus:border-[#ffd28e]/40 transition-colors [color-scheme:dark]"
                      />
                      <p className="text-xs text-white/40">Or edit manually after picking duration</p>
                    </div>
                    <div className="pt-2 border-t border-white/10">
                      <label htmlFor="price" className="block text-sm font-medium text-white/90 mb-2">Price (SOL)</label>
                      <input
                        id="price"
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full rounded-xl border border-white/20 bg-black/40 px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#ffd28e]/50 focus:border-[#ffd28e]/40 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={creating}
                      className="w-full px-5 py-3.5 rounded-xl font-semibold text-black focus:outline-none focus:ring-2 focus:ring-[#ffd28e] focus:ring-offset-2 focus:ring-offset-[#030305] disabled:opacity-60 disabled:pointer-events-none hover:opacity-95 transition-opacity"
                      style={{ backgroundColor: "#ffd28e" }}
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
