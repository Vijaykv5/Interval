"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const INVITE_CODE_PATTERN = /^[A-Za-z]{6}$/;

export function InviteGateForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inputId = useId();
  const errorId = useId();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedCode = code.trim().toUpperCase();
  const isCodeReady = INVITE_CODE_PATTERN.test(normalizedCode);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (!isCodeReady) {
      setError("Use exactly 6 letters.");
      return;
    }

    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/invite/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: normalizedCode }),
      });
      const data = (await response.json().catch(() => null)) as { error?: string } | null;

      if (!response.ok) {
        setError(data?.error ?? "Could not verify that code.");
        return;
      }

      const nextPath = searchParams.get("next");
      router.replace(nextPath?.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch {
      setError("Could not verify that code. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" aria-busy={isSubmitting}>
      <div className="space-y-2">
        <label htmlFor={inputId} className="block text-sm font-medium text-white/85">
          Invite code
        </label>
        <input
          id={inputId}
          name="invite-code"
          type="text"
          inputMode="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={6}
          pattern="[A-Za-z]{6}"
          value={code}
          onBlur={() => {
            if (code && !isCodeReady) setError("Use exactly 6 letters.");
          }}
          onChange={(event) => {
            setCode(event.target.value.replace(/[^A-Za-z]/g, "").toUpperCase());
            if (error) setError("");
          }}
          aria-invalid={error ? "true" : undefined}
          aria-describedby={error ? errorId : undefined}
          className="min-h-12 w-full rounded-xl border border-white/15 bg-white/8 px-4 text-center font-mono text-xl uppercase tracking-[0.35em] text-white caret-[#ffd28e] outline-none transition placeholder:text-white/25 focus:border-[#ffd28e] focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080c]"
          placeholder="ABCDEF"
        />
        {error ? (
          <p id={errorId} className="text-sm text-[#ffb4a8]">
            {error}
          </p>
        ) : (
          <p className="text-xs text-white/45">6 alphabet letters only.</p>
        )}
      </div>

      <button
        type="submit"
        disabled={!isCodeReady || isSubmitting}
        className="min-h-11 w-full rounded-xl bg-[#ffd28e] px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-black transition hover:bg-[#ffe0ad] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#08080c] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSubmitting ? "Checking..." : "Unlock access"}
      </button>
    </form>
  );
}
