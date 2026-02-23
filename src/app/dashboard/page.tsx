"use client";

import { useState, useEffect } from "react";

const CREATOR_ID =
  typeof process.env.NEXT_PUBLIC_DEMO_CREATOR_ID === "string" &&
  process.env.NEXT_PUBLIC_DEMO_CREATOR_ID.length > 0
    ? process.env.NEXT_PUBLIC_DEMO_CREATOR_ID
    : "PUT_CREATOR_ID_HERE";

type Slot = {
  id: string;
  startTime: string;
  endTime: string;
  price: number;
  status: string;
};

type DashboardData = {
  upcomingMeetings: Slot[];
  earnings: number;
  totalBookings: number;
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
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [price, setPrice] = useState("");
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (CREATOR_ID === "PUT_CREATOR_ID_HERE") {
      setLoading(false);
      setDashboard({
        upcomingMeetings: [],
        earnings: 0,
        totalBookings: 0,
      });
      return;
    }
    async function load() {
      try {
        const res = await fetch(
          `/api/dashboard?creatorId=${encodeURIComponent(CREATOR_ID)}`
        );
        if (res.ok) {
          const data = await res.json();
          setDashboard(data);
        } else {
          setDashboard({
            upcomingMeetings: [],
            earnings: 0,
            totalBookings: 0,
          });
        }
      } catch {
        setDashboard({
          upcomingMeetings: [],
          earnings: 0,
          totalBookings: 0,
        });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await fetch("/api/slot/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creatorId: CREATOR_ID,
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
        alert("Slot created!");
        if (CREATOR_ID !== "PUT_CREATOR_ID_HERE") {
          const refresh = await fetch(
            `/api/dashboard?creatorId=${encodeURIComponent(CREATOR_ID)}`
          );
          if (refresh.ok) setDashboard(await refresh.json());
        }
      } else {
        alert(data?.error ?? "Failed to create slot");
      }
    } finally {
      setCreating(false);
    }
  }

  const hasCreatorId = CREATOR_ID !== "PUT_CREATOR_ID_HERE";
  const meetings = dashboard?.upcomingMeetings ?? [];
  const earnings = dashboard?.earnings ?? 0;
  const totalBookings = dashboard?.totalBookings ?? 0;

  return (
    <div className="p-8 md:p-10 max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-8">
        Your upcoming meetings and earnings at a glance.
      </p>

      {!hasCreatorId && (
        <div className="mb-6 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Set <code className="bg-amber-100 px-1 rounded">NEXT_PUBLIC_DEMO_CREATOR_ID</code> in your env to load your meetings and earnings.
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
          {/* Upcoming meetings – first */}
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
