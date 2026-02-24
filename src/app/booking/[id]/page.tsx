import { prisma } from "@/lib/prisma";
import Link from "next/link";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
};

export default async function BookingPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Access required</h1>
          <p className="text-gray-600 text-sm mb-6">
            Use the link from your booking confirmation to access your meeting.
          </p>
          <Link
            href="/"
            className="inline-block text-gray-700 hover:text-gray-900 underline text-sm"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      slot: true,
      creator: true,
    },
  });

  if (!booking || booking.accessToken !== token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Invalid or expired link</h1>
          <p className="text-gray-600 text-sm mb-6">
            This link may be incorrect or has expired. Please contact the creator for a new link.
          </p>
          <Link
            href="/"
            className="inline-block text-gray-700 hover:text-gray-900 underline text-sm"
          >
            ← Back to home
          </Link>
        </div>
      </div>
    );
  }

  const meetLink = booking.slot.meetLink;
  const start = new Date(booking.slot.startTime).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-white/95 backdrop-blur rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Your meeting</h1>
        <p className="text-gray-500 text-sm mb-6">
          {booking.creator.username} · {start}
        </p>

        {meetLink ? (
          <a
            href={meetLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-4 px-6 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            Join meeting
          </a>
        ) : (
          <p className="text-gray-500 text-sm py-4">
            No meeting link available. Please contact {booking.creator.username}.
          </p>
        )}

        <p className="text-xs text-gray-400 mt-4 text-center">
          Only you and the creator have access to this meeting link.
        </p>

        <Link
          href="/"
          className="block mt-6 text-center text-gray-600 hover:text-gray-900 text-sm"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
