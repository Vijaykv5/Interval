"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type DodoStatusResponse = {
  status?: string;
  bookingId?: string | null;
  error?: string;
};

export default function DodoPaymentCompletePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paymentId = searchParams.get("payment_id");
  const rawStatus = searchParams.get("status");
  const [message, setMessage] = useState("Checking your payment...");
  const [error, setError] = useState<string | null>(null);
  const missingPaymentId = !paymentId;

  const statusLabel = useMemo(() => {
    if (!rawStatus) return "Processing";
    return rawStatus.replaceAll("_", " ");
  }, [rawStatus]);

  useEffect(() => {
    if (missingPaymentId) {
      return;
    }

    const activePaymentId = paymentId;
    let cancelled = false;

    async function poll() {
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const res = await fetch(
          `/api/payment/dodo/status?paymentId=${encodeURIComponent(activePaymentId)}`,
          { cache: "no-store" }
        );
        const data = (await res.json().catch(() => ({}))) as DodoStatusResponse;

        if (!res.ok) {
          throw new Error(data.error || "Could not verify your Dodo payment.");
        }

        if (cancelled) return;

        if (data.status === "succeeded" && data.bookingId) {
          router.replace(`/profile?booked=1&booking=${encodeURIComponent(data.bookingId)}&provider=dodo`);
          return;
        }

        if (data.status === "failed" || data.status === "cancelled") {
          setError("Your Dodo checkout did not complete.");
          setMessage("No booking was created.");
          return;
        }

        setMessage("Payment received. Waiting for booking confirmation...");
        await new Promise((resolve) => window.setTimeout(resolve, 2000));
      }

      setMessage("We’re still waiting on the final payment confirmation.");
    }

    void poll().catch((pollError) => {
      if (cancelled) return;
      setError(
        pollError instanceof Error
          ? pollError.message
          : "Could not verify your Dodo payment."
      );
      setMessage("Booking confirmation is taking longer than expected.");
    });

    return () => {
      cancelled = true;
    };
  }, [missingPaymentId, paymentId, router]);

  return (
    <main className="min-h-screen bg-[#060606] px-4 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[#101010] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.26)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd28e]/72">
          Dodo checkout
        </p>
        <h1
          className="mt-4 text-3xl font-semibold text-white"
          style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
        >
          {statusLabel}
        </h1>
        <p className="mt-4 text-sm leading-6 text-white/60">
          {missingPaymentId ? "We could not verify your checkout." : message}
        </p>
        {missingPaymentId ? (
          <p className="mt-4 text-sm text-red-300">
            Dodo did not return a payment id for this booking.
          </p>
        ) : error ? (
          <p className="mt-4 text-sm text-red-300">{error}</p>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/profile"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#ffd28e] px-5 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-[#ffc97a]"
          >
            Open Profile
          </Link>
          <Link
            href="/explore"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#171717] px-5 py-2.5 text-sm font-medium text-white/84 transition-colors hover:bg-[#202020] hover:text-white"
          >
            Back to explore
          </Link>
        </div>
      </div>
    </main>
  );
}
