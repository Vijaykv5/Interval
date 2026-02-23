"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletAuth } from "@/components/wallet-auth";

const navItems = [{ href: "/dashboard", label: "Dashboard" }];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar - white bg */}
      <aside className="w-56 shrink-0 bg-white border-r border-gray-200 shadow-sm flex flex-col">
        <div className="p-5 border-b border-gray-100">
          <Link href="/dashboard" className="font-semibold text-gray-800 text-lg tracking-tight">
            Interval
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-gray-100 space-y-2">
          <WalletAuth variant="sidebar" />
          <Link
            href="/"
            className="block px-3 py-2.5 rounded-lg text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
          >
            ← Back home
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
