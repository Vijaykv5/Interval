import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDialBlinkUrl } from "@/lib/constants";
import { SlotBookingButton } from "@/components/slot-booking-button";
import { SiteNav } from "@/components/site-nav";
import { prisma } from "@/lib/prisma";

type CreatorPageProps = {
  params: Promise<{
    username: string;
  }>;
};

function formatSlotDate(iso: Date) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatSlotTime(iso: Date) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

async function getCreatorByUsername(username: string) {
  return prisma.creator.findUnique({
    where: { username },
    include: {
      slots: {
        where: { status: "available" },
        orderBy: { startTime: "asc" },
      },
    },
  });
}

async function getBaseUrl() {
  const envBaseUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (envBaseUrl) return envBaseUrl;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";

  return host ? `${protocol}://${host}` : "";
}

export async function generateMetadata({
  params,
}: CreatorPageProps): Promise<Metadata> {
  const { username } = await params;
  const creator = await getCreatorByUsername(username);

  if (!creator) {
    return {
      title: "Creator not found",
    };
  }

  return {
    title: `@${creator.username} — Book on Interval`,
    description:
      creator.bio ??
      `Browse available slots and book time with @${creator.username} on Interval.`,
  };
}

export default async function CreatorPage({ params }: CreatorPageProps) {
  const { username } = await params;
  const creator = await getCreatorByUsername(username);

  if (!creator) {
    notFound();
  }

  const baseUrl = await getBaseUrl();

  return (
    <div className="min-h-screen text-white">
      <SiteNav />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="mb-8 sm:mb-10">
          <Link
            href="/explore"
            className="text-white/70 hover:text-white font-medium inline-flex items-center gap-1 mb-4 sm:mb-6 transition-colors"
          >
            ← Back to creators
          </Link>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              {creator.profileImageUrl ? (
                <img
                  src={creator.profileImageUrl}
                  alt={creator.username}
                  className="w-24 h-24 rounded-2xl object-cover"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-white/10 flex items-center justify-center text-3xl font-bold text-white/50">
                  {creator.username.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-white/50 text-sm">Creator profile</p>
                <h1 className="text-3xl sm:text-4xl font-bold text-white mt-1">
                  @{creator.username}
                </h1>
                {creator.bio && (
                  <p className="text-white/75 mt-3 max-w-2xl text-sm sm:text-base">
                    {creator.bio}
                  </p>
                )}
                <p className="text-white/55 mt-4 text-sm">
                  Unique link: {baseUrl ? `${baseUrl}/explore/${creator.username}` : `/explore/${creator.username}`}
                </p>
              </div>

            </div>
          </div>
        </div>

        {creator.launchedTokenMint && creator.launchedTokenUrl && (
          <section className="rounded-3xl border border-[#ffd28e]/20 bg-[#ffd28e]/8 p-5 sm:p-6 mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ffd28e]">
                  Launched token
                </p>
                <h2 className="text-xl font-bold text-white mt-2">
                  {creator.launchedTokenName ?? `@${creator.username} token`}
                </h2>
                <p className="text-sm text-white/70 mt-1">
                  {creator.launchedTokenSymbol ? `$${creator.launchedTokenSymbol}` : creator.launchedTokenMint}
                </p>
              </div>
              <a
                href={creator.launchedTokenUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-black hover:opacity-90"
                style={{ backgroundColor: "#ffd28e" }}
              >
                View on Bags →
              </a>
            </div>
          </section>
        )}

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                Available slots
              </h2>
              <p className="text-white/60 text-sm mt-1">
                Pick a slot to open its Blink booking page.
              </p>
            </div>
            <div className="text-sm text-white/55">
              {creator.slots.length} slot{creator.slots.length !== 1 ? "s" : ""}
            </div>
          </div>

          {creator.slots.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-6 text-white/60">
              No slots available right now.
            </div>
          ) : (
            <ul className="space-y-3">
              {creator.slots.map((slot) => {
                const actionUrl = `${baseUrl}/api/action/book?slotId=${slot.id}`;
                return (
                  <li key={slot.id}>
                    <a
                      href={getDialBlinkUrl(actionUrl)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 sm:p-5 hover:border-white/20 hover:bg-white/10 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {formatSlotDate(slot.startTime)}
                        </p>
                        <p className="text-sm text-white/60 mt-1">
                          {formatSlotTime(slot.startTime)} - {formatSlotTime(slot.endTime)}
                        </p>
                      </div>

                      <div className="sm:text-right">
                        <p className="text-base font-semibold text-white">
                          {slot.price % 1 === 0 ? slot.price : slot.price.toFixed(slot.currency === "SOL" ? 4 : 2)} {slot.currency}
                        </p>
                        <p className="text-sm text-white/50 mt-1">
                          Book via Blink →
                        </p>
                      </div>
                    </a>
                    <div className="mt-3 sm:flex sm:justify-end">
                      <SlotBookingButton
                        slotId={slot.id}
                        creatorId={creator.id}
                        creatorWallet={creator.wallet}
                        price={slot.price}
                        currency={slot.currency}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
