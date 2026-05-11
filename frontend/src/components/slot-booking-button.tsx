"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useUserWallet } from "@/components/user-wallet-provider";
import { formatPaymentAmount, payForSlot, type Currency } from "@/lib/payments";

const isDodoEnabled = process.env.NEXT_PUBLIC_DODO_ENABLED !== "false";
const isKiroEnabled =
  process.env.NEXT_PUBLIC_KIRO_ENABLED === "true" ||
  process.env.NEXT_PUBLIC_KIRA_ENABLED === "true";

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
  const {
    ready,
    connected,
    wallet,
    walletAddress,
    openConnectModal,
    signAndSendTransaction,
  } = useUserWallet();
  const [booking, setBooking] = useState(false);
  const [kiraLoading, setKiraLoading] = useState(false);
  const [dodoLoading, setDodoLoading] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const canBook = ready && connected && wallet && walletAddress;
  const canBookWithDodo = currency === "USDC" && isDodoEnabled;
  const canBookWithKira = currency === "USDC" && isKiroEnabled;

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
    if (!ready) return;
    try {
      openConnectModal();
    } catch (connectError) {
      const msg =
        connectError instanceof Error
          ? connectError.message
          : "Wallet connection failed.";
      toast.error(msg);
    }
  }

  function handleBookClick() {
    if (!canBook) {
      handleConnect();
      return;
    }

    setPaymentModalOpen(true);
  }

  async function handleCryptoPayment(paymentCurrency: Currency) {
    if (!canBook || !wallet || !walletAddress) {
      const msg = "Connect your wallet before booking.";
      toast.error(msg);
      return;
    }

    setBooking(true);
    try {
      const txSignature = await payForSlot({
        wallet,
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
      toast.error(msg);
    } finally {
      setBooking(false);
    }
  }

  async function handleKiraPayment() {
    if (!canBook) {
      const msg = "Connect your wallet before booking.";
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
      toast.error(msg);
    } finally {
      setKiraLoading(false);
    }
  }

  async function handleDodoPayment() {
    if (!canBook || !walletAddress) {
      const msg = "Connect your wallet before booking.";
      toast.error(msg);
      return;
    }

    setDodoLoading(true);
    try {
      const res = await fetch("/api/payment/dodo/checkout", {
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
        throw new Error(data?.error ?? "Dodo checkout could not be created for this slot.");
      }

      if (data.sessionId) {
        window.sessionStorage.setItem(
          `interval:dodo-booking:${slotId}:${walletAddress}`,
          data.sessionId
        );
      }
      window.location.href = data.checkoutUrl;
    } catch (err) {
      console.error("Dodo checkout failed:", err);
      const msg =
        err instanceof Error ? err.message : "Dodo checkout could not be started.";
      toast.error(msg);
    } finally {
      setDodoLoading(false);
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
              : !connected
                  ? "Connect wallet to book"
                  : "Book"}
        </button>
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
                  Choose your payment flow
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  {currency === "USDC"
                    ? "Pay with USDC from your wallet or through card."
                    : currency === "PUSD"
                      ? "Pay PUSD directly from your wallet to confirm this booking."
                      : "Pay with SOL through the Interval booking contract."}
                </p>
              </div>

              <div className="mt-6 space-y-3">
                {canBookWithDodo ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#ffd28e]/75">
                      Recommended: pay with your card
                    </p>
                    <button
                      type="button"
                      onClick={handleDodoPayment}
                      disabled={booking || kiraLoading || dodoLoading}
                      className="group flex min-h-14 w-full items-center justify-between rounded-2xl border border-[#ffd28e]/30 bg-[#ffd28e]/10 px-4 py-4 text-left transition-colors hover:border-[#ffd28e]/55 hover:bg-[#ffd28e]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:pointer-events-none disabled:opacity-60"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-white">
                          Pay with Card
                        </span>
                        <span className="mt-1 block text-xs text-white/55">
                          {dodoLoading ? "Opening checkout..." : "Checkout with your fiat currency"}
                        </span>
                      </span>
                      <span className="text-sm font-medium text-[#ffd28e]">
                        {dodoLoading ? "Opening..." : "Continue"}
                      </span>
                    </button>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => handleCryptoPayment(currency)}
                  disabled={booking || kiraLoading || dodoLoading}
                  className="group flex min-h-14 w-full items-center justify-between rounded-2xl border border-[#ffd28e]/25 bg-[#13111a] px-4 py-4 text-left transition-colors hover:border-[#ffd28e]/45 hover:bg-[#18151f] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:pointer-events-none disabled:opacity-60"
                >
                  <span>
                    <span className="block text-sm font-semibold text-white">
                      {currency === "SOL"
                        ? "Book with SOL"
                        : currency === "PUSD"
                          ? "Book with PUSD"
                          : "Pay with USDC directly"}
                    </span>
                    <span className="mt-1 block text-xs text-white/50">
                      {booking
                        ? currency === "SOL"
                          ? "Submitting the on-chain booking transaction..."
                          : `Sending ${currency} to the creator wallet...`
                        : currency === "SOL"
                          ? `${formatPaymentAmount(price, currency)} through the Interval booking contract`
                          : `${formatPaymentAmount(price, currency)} direct wallet transfer`}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-[#ffd28e]">
                    {booking ? "Processing..." : "Continue"}
                  </span>
                </button>

                {canBookWithKira ? (
                  <button
                    type="button"
                    onClick={handleKiraPayment}
                    disabled={booking || kiraLoading || dodoLoading}
                    className="group flex min-h-14 w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition-colors hover:border-white/20 hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b0a10] disabled:pointer-events-none disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-white">
                        Pay with KIRAPAY
                      </span>
                      <span className="mt-1 block text-xs text-white/50">
                        {kiraLoading
                          ? "Opening hosted checkout..."
                          : "Hosted checkout for this USDC booking"}
                      </span>
                    </span>
                    <span className="text-sm font-medium text-[#ffd28e]">
                      {kiraLoading ? "Opening..." : "Continue"}
                    </span>
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
