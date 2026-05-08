"use client";

import { useEffect } from "react";

type CreatorAccessCodeModalProps = {
  open: boolean;
  code: string;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onCodeChange: (code: string) => void;
  onSubmit: (code: string) => void | Promise<void>;
};

export function CreatorAccessCodeModal({
  open,
  code,
  loading = false,
  error = null,
  onClose,
  onCodeChange,
  onSubmit,
}: CreatorAccessCodeModalProps) {
  useEffect(() => {
    if (!open) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !loading) {
        onClose();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [loading, onClose, open]);

  if (!open) return null;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit(code);
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[120] bg-black/82 backdrop-blur-md"
        aria-hidden
        onClick={() => {
          if (!loading) onClose();
        }}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="creator-access-modal-title"
        className="fixed inset-0 z-[130] flex items-center justify-center px-4 py-6"
      >
        <div className="relative w-full max-w-lg overflow-hidden rounded-[2rem] border border-[#ffd28e]/20 bg-[#0b0a10]/98 shadow-2xl shadow-black/70">
          <h2 id="creator-access-modal-title" className="sr-only">
            Creator access code
          </h2>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="absolute right-5 top-5 z-10 inline-flex min-h-10 min-w-10 items-center justify-center text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Close access code modal"
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

          <form onSubmit={handleSubmit} className="px-6 py-6 sm:px-8 sm:py-7">
            <div className="mx-auto max-w-md text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#ffd28e]/75">
              Creator access
              </p>
              <h3
                className="mt-3 text-3xl font-bold leading-[1.05] text-white sm:text-[2.25rem]"
                style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
              >
                Creator sign up is invite-only.
              </h3>
              <p className="mt-3 text-sm leading-6 text-white/58 sm:text-base">
                High-rated curated profiles can continue with an access code.
              </p>
            </div>

            <div className="mx-auto mt-6 max-w-md">
              <label
                htmlFor="creator-access-code"
                className="mb-2 block text-sm font-medium text-white/82"
              >
                Access code
              </label>
              <input
                id="creator-access-code"
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => onCodeChange(event.target.value.toUpperCase())}
                placeholder="Enter access code"
                disabled={loading}
                className="min-h-11 w-full rounded-xl border border-white/12 bg-white/[0.04] px-4 text-base text-white placeholder:text-white/28 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>

            {error ? (
              <p className="mx-auto mt-3 max-w-md text-sm text-center text-red-300">{error}</p>
            ) : (
              <p className="mx-auto mt-3 max-w-md text-sm text-center text-white/42">
                Only approved creators can continue.
              </p>
            )}

            <div className="mx-auto mt-5 flex max-w-md flex-col gap-3">
              <button
                type="submit"
                disabled={loading || code.trim().length === 0}
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#ffd28e]/35 bg-[#ffd28e]/10 px-6 text-sm font-semibold text-[#ffd28e] transition-all hover:bg-[#ffd28e] hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Checking code..." : "Continue as creator"}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="inline-flex min-h-10 items-center justify-center text-sm font-medium text-white/55 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Back
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
