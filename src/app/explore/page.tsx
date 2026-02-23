import Link from "next/link";

export default function Explore() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
          Connect with creators
        </h1>
        <p className="text-gray-600 mb-8">
          Browse creators and book a slot. This page will list available creators soon.
        </p>
        <Link
          href="/"
          className="text-gray-900 font-medium underline hover:no-underline"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
