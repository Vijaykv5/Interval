"use client";

import { useEffect, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { toast } from "sonner";
import { setAuthIntent } from "@/lib/auth-intent";
import { formatPaymentAmount, payForSlot, type Currency } from "@/lib/payments";

type SlotBookingButtonProps = {
  slotId: string;
  creatorId: string;
  creatorWallet: string;
  price: number;
  currency: Currency;
  scheduledEndTime: string;
};

export function SlotBookingButton({
  slotId,
  creatorId,
  creatorWallet,
  price,
  currency,
  scheduledEndTime,
}: SlotBookingButtonProps) {
  const { ready, authenticated, login, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [booking, setBooking] = useState(false);
  const [kiraLoading, setKiraLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? null;
  const canBook = ready && authenticated && solanaWallet && walletAddress;
  const canBookWithPusd = currency !== "PUSD";

  useEffect(() => {
    if (!paymentModalOpen) return;

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !booking) {
        setPaymentModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [paymentModalOpen, booking]);

  function handleConnect() {
    setError(null);

    if (!ready) return;
    if (!authenticated) {
      const msg = "Sign in to book this slot.";
      setError(msg);
      toast.error(msg);
      setAuthIntent("user");
      login();
      return;
    }

    connectWallet();
  }

  function handleBookClick() {
    setError(null);

    if (!canBook) {
      handleConnect();
      return;
    }

    setPaymentModalOpen(true);
  }

  async function handleCryptoPayment(paymentCurrency: Currency) {
    setError(null);

    if (!canBook) {
      const msg = "Connect your wallet before booking.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setBooking(true);
    try {
      const txSignature = await payForSlot({
        wallet: solanaWallet,
        signAndSendTransaction,
        payerWallet: walletAddress,
        creatorWallet,
        slotId,
        scheduledEndTime,
        price,
        currency: paymentCurrency,
      });

      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId,
          creatorId,
          userId: walletAddress,
          amount: price,
          currency: paymentCurrency,
          txSignature,
          status: "confirmed",
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error ?? "Payment succeeded, but booking creation failed.");
      }

      toast.success("Booking confirmed!", {
        description: txSignature,
      });
      setPaymentModalOpen(false);

      if (data?.booking?.id) {
        window.location.href = `/profile?booked=1&booking=${encodeURIComponent(data.booking.id)}`;
      }
    } catch (err) {
      console.error("Booking payment failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "Transaction failed. Your booking was not created.";
      setError(msg);
      toast.error(msg);
    } finally {
      setBooking(false);
    }
  }

  async function handleKiraPayment() {
    setError(null);

    if (!canBook) {
      const msg = "Connect your wallet before booking.";
      setError(msg);
      toast.error(msg);
      return;
    }

    setKiraLoading(true);
    try {
      const res = await fetch("/api/payment/kirapay/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId,
          creatorId,
          creatorWallet,
          payerWallet: walletAddress,
          price,
          currency,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.checkoutUrl) {
        throw new Error(
          data?.error ?? "KIRAPAY checkout could not be created for this slot."
        );
      }

      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("KIRAPAY checkout failed:", err);
      const msg =
        err instanceof Error
          ? err.message
          : "KIRAPAY checkout could not be started.";
      setError(msg);
      toast.error(msg);
    } finally {
      setKiraLoading(false);
    }
  }

  return (
    <>
      <div className="space-y-2">
        <button
          type="button"
          onClick={handleBookClick}
          disabled={!ready || booking}
          className="inline-flex min-h-10 w-full sm:w-auto items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-black hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
          style={{ backgroundColor: "#ffd28e" }}
        >
          {!ready
            ? "Loading..."
            : booking
              ? "Booking..."
              : !authenticated
                ? "Sign in to book"
                : !walletAddress
                  ? "Connect wallet to book"
                  : "Book"}
        </button>
        {error && (
          <p className="max-w-xs text-sm text-red-200">
            {error}
          </p>
        )}
        <p className="text-xs text-white/45">
          {currency === "PUSD"
            ? formatPaymentAmount(price, "PUSD")
            : `${formatPaymentAmount(price, currency)} or ${formatPaymentAmount(price, "PUSD")}`}
        </p>
      </div>

      {paymentModalOpen && (
        <>
          <div
            className="fixed inset-0 z-[100] bg-black/72 backdrop-blur-sm"
            aria-hidden
            onClick={() => {
              if (!booking) {
                setPaymentModalOpen(false);
              }
            }}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-modal-title"
            className="fixed inset-0 z-[110] flex items-center justify-center px-4 py-6"
          >
            <div className="relative w-full max-w-md rounded-[1.75rem] border border-[#ffd28e]/20 bg-[#0b0a10]/95 p-6 shadow-2xl shadow-black/60 sm:p-7">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                disabled={booking}
                className="absolute right-4 top-4 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:pointer-events-none disabled:opacity-40"
                aria-label="Close payment options"
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

              <div className="pr-10">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#ffd28e]/70">
                  Payment
                </p>
                <h2
                  id="payment-modal-title"
                  className="mt-3 text-2xl font-bold text-white"
                >
                  Pay with crypto
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Choose how you want to complete this booking. PUSD payments go directly from the user wallet to the creator wallet.
                </p>
              </div>

              <div className="mt-6 space-y-3">
                <button
                  type="button"
                  onClick={() => handleCryptoPayment(currency)}
                  disabled={booking || kiraLoading}
                  className="group flex min-h-14 w-full items-center justify-between rounded-2xl border border-[#ffd28e]/25 bg-[#13111a] px-4 py-4 text-left transition-colors hover:border-[#ffd28e]/45 hover:bg-[#18151f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:pointer-events-none disabled:opacity-60"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {currency === "PUSD" ? "Book with PUSD" : `Pay with ${currency}`}
                    </span>
                    <span className="mt-1 block text-xs text-white/50">
                      {booking ? "Processing your wallet payment..." : formatPaymentAmount(price, currency)}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-[#ffd28e]">
                    {booking ? "Processing..." : "Continue"}
                  </span>
                </button>

                {canBookWithPusd ? (
                  <button
                    type="button"
                    onClick={() => handleCryptoPayment("PUSD")}
                    disabled={booking || kiraLoading}
                    className="group flex min-h-14 w-full items-center justify-between rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.06] px-4 py-4 text-left transition-colors hover:border-emerald-300/40 hover:bg-emerald-500/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:pointer-events-none disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Book with PUSD
                      </span>
                      <span className="mt-1 block text-xs text-white/55">
                        {booking
                          ? "Sending PUSD to the creator wallet..."
                          : `${formatPaymentAmount(price, "PUSD")} direct to creator wallet`}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-emerald-200">
                      {booking ? "Processing..." : "Use PUSD"}
                    </span>
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={handleKiraPayment}
                  disabled={booking || kiraLoading}
                  className="group flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:pointer-events-none disabled:opacity-60"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      Pay with KIRAPAY
                    </span>
                    <span className="mt-1 block text-xs text-white/50">
                      {kiraLoading
                        ? "Opening hosted checkout..."
                        : "Cross-chain checkout powered by KIRAPAY"}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-[#ffd28e]">
                    {kiraLoading ? "Opening..." : "Continue"}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
