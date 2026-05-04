import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { InviteGateForm } from "@/components/invite-gate-form";

export default function InvitePage() {
  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link
            href="/invite"
            className="inline-flex min-h-10 items-center gap-1.5 rounded px-1 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
          >
            <span
              className="text-lg font-bold uppercase tracking-[0.12em] sm:text-xl"
              style={{ color: "#ffd28e", fontFamily: "var(--font-archivo-condensed), sans-serif" }}
            >
              INTERVAL
            </span>
            <Image
              src="/favicon.png"
              alt=""
              width={24}
              height={24}
              className="h-5 w-5 object-contain opacity-95 sm:h-6 sm:w-6"
              priority
            />
          </Link>
        </header>

        <section className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md rounded-2xl border border-white/12 bg-[#08080c]/80 p-5 shadow-2xl shadow-black/30 backdrop-blur-md sm:p-6">
            <div className="mb-6">
              <p
                className="mb-2 text-sm uppercase tracking-[0.22em]"
                style={{ color: "#ffd28e", fontFamily: "var(--font-archivo-condensed), sans-serif" }}
              >
                Private ACcess
              </p>
              <h1
                className="text-3xl uppercase tracking-[0.08em] text-white sm:text-4xl"
                style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
              >
                Enter invite code
              </h1>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Interval is invite-only for now. Use your 6-letter code to continue.
              </p>
            </div>

            <Suspense fallback={<InviteFormFallback />}>
              <InviteGateForm />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}

function InviteFormFallback() {
  return (
    <div className="space-y-4" aria-hidden>
      <div className="space-y-2">
        <div className="h-5 w-24 rounded bg-white/10" />
        <div className="h-12 w-full rounded-xl bg-white/8" />
        <div className="h-4 w-32 rounded bg-white/10" />
      </div>
      <div className="h-11 w-full rounded-xl bg-[#ffd28e]/60" />
    </div>
  );
}
