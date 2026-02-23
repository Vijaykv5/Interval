"use client";

import { useState, useEffect } from "react";
import { useWallets } from "@privy-io/react-auth/solana";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  status: string;
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

  useEffect(() => {
    if (!walletAddress) {
      setLoading(false);
      setDashboard({
        upcomingMeetings: [],
        earnings: 0,
        totalBookings: 0,
        mySlots: [],
        bookings: [],
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
          });
        } else {
          setDashboard({
            upcomingMeetings: [],
            earnings: 0,
            totalBookings: 0,
            mySlots: [],
            bookings: [],
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
          const refresh = await fetch(
            `/api/dashboard?creatorId=${encodeURIComponent(creator.id)}`
          );
          if (refresh.ok) {
            const refreshed = await refresh.json();
            setDashboard({
              ...refreshed,
              mySlots: refreshed.mySlots ?? [],
              bookings: refreshed.bookings ?? [],
            });
          }
        }
      } else {
        alert(data?.error ?? "Failed to create slot");
      }
    } finally {
      setCreating(false);
    }
  }

  const hasCreator = creator != null;
  const meetings = dashboard?.upcomingMeetings ?? [];
  const mySlots = dashboard?.mySlots ?? [];
  const bookings = dashboard?.bookings ?? [];
  const earnings = dashboard?.earnings ?? 0;
  const totalBookings = dashboard?.totalBookings ?? 0;

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
    <div className="p-8 md:p-10 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">
        Your upcoming meetings and earnings at a glance.
      </p>

      {hasCreator && (
        <p className="text-sm text-gray-500 mb-2">
          Logged in as <span className="font-medium text-gray-700">{creator.username}</span>
        </p>
      )}
      {!walletAddress && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Connect your wallet in the sidebar to create slots and see your dashboard.
        </div>
      )}

      {loading ? (
        <div className="space-y-6 mb-10">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-48 animate-pulse" />
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-36 animate-pulse" />
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 h-36 animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* Your slots – list from DB with blink links */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Your slots
            </h2>
            {mySlots.length === 0 ? (
              <div className="text-center py-6 text-gray-500">
                <p className="font-medium text-gray-700">No slots yet</p>
                <p className="text-sm mt-1">
                  Create a slot below. Each slot gets a Solana blink link to share for booking.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {mySlots.map((slot) => (
                  <li
                    key={slot.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatMeetingDate(slot.startTime)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatMeetingTime(slot.startTime)} – {formatMeetingTime(slot.endTime)} · {Number(slot.price).toFixed(2)} SOL
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {slot.status === "available" ? (
                        <>
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                            Available
                          </span>
                          <button
                            type="button"
                            onClick={() => copyBlink(slot.id)}
                            className="text-sm font-medium text-gray-700 hover:text-gray-900 underline"
                          >
                            Copy blink link
                          </button>
                        </>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                          Booked
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Payments / Bookings */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Payments & bookings
            </h2>
            {bookings.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <p className="font-medium text-gray-700">No bookings yet</p>
                <p className="text-sm mt-1">
                  When someone pays for a slot via the blink, they’ll appear here with their details.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {bookings.map((b) => (
                  <li
                    key={b.id}
                    className="py-4 first:pt-0 last:pb-0 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-gray-900">
                        {formatMeetingDate(b.slot.startTime)} · {Number(b.amountSol).toFixed(2)} SOL
                      </p>
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Paid
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      Slot: {formatMeetingTime(b.slot.startTime)} – {formatMeetingTime(b.slot.endTime)}
                    </p>
                    <p className="text-xs font-mono text-gray-500 truncate" title={b.payerWallet}>
                      From: {b.payerWallet}
                    </p>
                    {(b.name || b.email || b.callFor) && (
                      <div className="text-sm text-gray-600 pt-1 border-t border-gray-100 mt-2">
                        {b.name && <p><span className="text-gray-500">Name:</span> {b.name}</p>}
                        {b.email && <p><span className="text-gray-500">Email:</span> {b.email}</p>}
                        {b.callFor && <p><span className="text-gray-500">Purpose:</span> {b.callFor}</p>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Upcoming meetings */}
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8 mb-8">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">
              Upcoming meetings
            </h2>
            {meetings.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <p className="font-medium text-gray-700">No upcoming meetings</p>
                <p className="text-sm mt-1">
                  Booked meetings will appear here. Create slots and share the link to get bookings.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {meetings.map((slot) => (
                  <li
                    key={slot.id}
                    className="py-4 first:pt-0 last:pb-0 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatMeetingDate(slot.startTime)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatMeetingTime(slot.startTime)} – {formatMeetingTime(slot.endTime)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        Booked
                      </span>
                      <span className="font-semibold text-gray-900">
                        {Number(slot.price).toFixed(2)} SOL
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Earnings & stats */}
          <section className="grid gap-6 sm:grid-cols-2 mb-10">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                Total earnings
              </p>
              <p className="text-3xl md:text-4xl font-bold text-gray-900">
                {earnings.toFixed(2)} <span className="text-lg font-semibold text-gray-500">SOL</span>
              </p>
              <p className="text-sm text-gray-500 mt-2">
                From {totalBookings} booked meeting{totalBookings !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
              <p className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">
                Upcoming booked
              </p>
              <p className="text-3xl md:text-4xl font-bold text-gray-900">
                {meetings.length}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Meeting{meetings.length !== 1 ? "s" : ""} in the future
              </p>
            </div>
          </section>
        </>
      )}

      {/* Create slot */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 md:p-8">
        <h2 className="text-lg font-semibold text-gray-800 mb-5">
          Create slot
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="startTime"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Start time
            </label>
            <input
              id="startTime"
              type="datetime-local"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>
          <div>
            <label
              htmlFor="endTime"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              End time
            </label>
            <input
              id="endTime"
              type="datetime-local"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>
          <div>
            <label
              htmlFor="price"
              className="block text-sm font-medium text-gray-700 mb-1.5"
            >
              Price (SOL)
            </label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="w-full sm:w-auto bg-gray-900 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:pointer-events-none"
          >
            {creating ? "Creating…" : "Create slot"}
          </button>
        </form>
      </section>
    </div>
  );
}
