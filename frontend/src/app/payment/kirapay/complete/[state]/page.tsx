"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PaymentStatusResponse = {
  status: string;
  bookingId?: string | null;
  providerStatus?: string | null;
  error?: string;
};

type KiraCompletePageProps = {
  params: Promise<{
    state: string;
  }>;
};

export default function KiraPaymentCompletePage({ params }: KiraCompletePageProps) {
  const router = useRouter();
  const [stateParam, setStateParam] = useState<string | null>(null);
  const [statusText, setStatusText] = useState("Checking your payment...");

  useEffect(() => {
    let mounted = true;
    params.then((resolved) => {
      if (mounted) setStateParam(resolved.state);
    });
    return () => {
      mounted = false;
    };
  }, [params]);

  const statusUrl = useMemo(() => {
    if (!stateParam) return null;
    return `/api/payment/kirapay/status/${encodeURIComponent(stateParam)}`;
  }, [stateParam]);

  useEffect(() => {
    if (statusUrl === null) return;
    const resolvedStatusUrl: string = statusUrl;

    let active = true;
    let intervalId: number | null = null;

    async function checkStatus() {
      try {
        const res = await fetch(resolvedStatusUrl, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as PaymentStatusResponse;

        if (!active) return;

        if (!res.ok) {
          router.replace(
            `/profile?kirapay=error&message=${encodeURIComponent(
              data.error ?? "Failed to verify KIRAPAY payment."
            )}`
          );
          return;
        }

        const normalized = data.status.toLowerCase();

        if (normalized === "settled" || normalized === "completed" || normalized === "success") {
          if (data.bookingId) {
            router.replace(`/profile?booked=1&booking=${encodeURIComponent(data.bookingId)}&provider=kirapay`);
            return;
          }

          setStatusText("Payment settled. Finalizing your booking...");
          return;
        }

        if (normalized === "failed" || normalized === "cancelled") {
          router.replace(
            `/profile?kirapay=error&message=${encodeURIComponent(
              data.providerStatus || "KIRAPAY payment did not complete."
            )}`
          );
          return;
        }

        setStatusText("Payment detected. Waiting for KIRAPAY confirmation...");
      } catch {
        if (!active) return;
        router.replace(
          `/profile?kirapay=error&message=${encodeURIComponent(
            "Could not verify your KIRAPAY payment right now."
          )}`
        );
      }
    }

    void checkStatus();
    intervalId = window.setInterval(() => {
      void checkStatus();
    }, 3000);

    return () => {
      active = false;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
    };
  }, [router, statusUrl]);

  return (
    <main className="min-h-screen bg-[#060606] px-4 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-[2rem] border border-white/10 bg-[#101010] p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd28e]/72">
          KIRAPAY
        </p>
        <h1
          className="mt-4 text-3xl font-bold text-white"
          style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
        >
          Finalizing your booking
        </h1>
        <p className="mt-4 text-sm leading-6 text-white/65">
          {statusText}
        </p>
        <div className="mx-auto mt-8 h-12 w-12 animate-spin rounded-full border-2 border-white/15 border-t-[#ffd28e]" />
      </div>
    </main>
  );
}
