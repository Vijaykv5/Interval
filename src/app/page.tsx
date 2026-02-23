import Link from "next/link";
import { WalletAuth } from "@/components/wallet-auth";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 relative">
      <WalletAuth />
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
          Book time with creators
        </h1>
        <p className="text-lg text-gray-600 mb-12">
          Create your slots or find a creator and schedule a meeting.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch sm:items-center">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-white border-2 border-gray-900 text-gray-900 font-semibold shadow-sm hover:bg-gray-50 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
          >
            Want to create a slot?
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-gray-900 text-white font-semibold shadow-sm hover:bg-gray-800 hover:shadow-md transition-all focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
          >
            Connect with creator?
          </Link>
        </div>
      </div>
    </div>
  );
}
