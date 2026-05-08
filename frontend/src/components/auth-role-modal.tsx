"use client";

import { useEffect } from "react";
import type { AuthIntentRole } from "@/lib/auth-intent";

type AuthRoleModalProps = {
  open: boolean;
  onClose: () => void;
  onSelectRole: (role: AuthIntentRole) => void;
};

const roleCards: Array<{
  role: AuthIntentRole;
  eyebrow: string;
  title: string;
  description: string;
  cta: string;
}> = [
  {
    role: "creator",
    eyebrow: "Creator / Founder",
    title: "Open paid slots and build your booking page.",
    description:
      "Sign in with Gmail, finish your creator onboarding, then manage your dashboard and availability.",
    cta: "Continue as creator",
  },
  {
    role: "user",
    eyebrow: "User / Booker",
    title: "Find creators, track bookings, and join calls smoothly.",
    description:
      "Sign in with Gmail to unlock your user profile, wallet view, and booking activity.",
    cta: "Continue as user",
  },
];

export function AuthRoleModal({
  open,
  onClose,
  onSelectRole,
}: AuthRoleModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/72 backdrop-blur-sm"
        aria-hidden
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-role-modal-title"
        className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6"
      >
        <div className="relative w-full max-w-5xl overflow-hidden rounded-[2rem] border border-[#ffd28e]/20 bg-[#0b0a10]/95 shadow-2xl shadow-black/60">
          <h2 id="auth-role-modal-title" className="sr-only">
            Choose sign-in path
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="absolute right-5 top-5 z-10 inline-flex min-h-10 min-w-10 items-center justify-center text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] sm:right-7 sm:top-6"
            aria-label="Close sign-in options"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          <div className="grid gap-px bg-white/10 md:grid-cols-2">
            {roleCards.map((card) => (
              <button
                key={card.role}
                type="button"
                onClick={() => onSelectRole(card.role)}
                className="group flex min-h-[300px] flex-col justify-between bg-[#0f0e14] px-6 py-8 text-left transition-colors hover:bg-[#15131c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ffd28e] sm:px-8 sm:py-10 md:pt-16"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd28e]/75">
                    {card.eyebrow}
                  </p>
                  <h3
                    className="mt-6 max-w-sm text-3xl font-bold leading-tight text-white sm:text-4xl"
                    style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
                  >
                    {card.role === "creator" ? "Are you a creator?" : "Looking for creators?"}
                  </h3>
                  <p className="mt-5 max-w-md text-base leading-7 text-white/68">
                    {card.title}
                  </p>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/52">
                    {card.description}
                  </p>
                </div>

                <span className="mt-10 inline-flex min-h-11 items-center justify-center rounded-full border border-[#ffd28e]/35 bg-[#ffd28e]/10 px-5 text-sm font-semibold text-[#ffd28e] transition-all group-hover:bg-[#ffd28e] group-hover:text-black">
                  {card.cta}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
