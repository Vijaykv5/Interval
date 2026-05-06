"use client";

import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignAndSendTransaction } from "@privy-io/react-auth/solana";
import { toast } from "sonner";
import { formatPaymentAmount, payForSlot, type Currency } from "@/lib/payments";

type SlotBookingButtonProps = {
  slotId: string;
  creatorId: string;
  creatorWallet: string;
  price: number;
  currency: Currency;
};

export function SlotBookingButton({
  slotId,
  creatorId,
  creatorWallet,
  price,
  currency,
}: SlotBookingButtonProps) {
  const { ready, authenticated, login, connectWallet } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const [booking, setBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const solanaWallet = wallets[0];
  const walletAddress = solanaWallet?.address ?? null;
  const canBook = ready && authenticated && solanaWallet && walletAddress;

  function handleConnect() {
    setError(null);

    if (!ready) return;
    if (!authenticated) {
      login();
      return;
    }

    connectWallet();
  }

  async function handleBook() {
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
        price,
        currency,
      });

      const res = await fetch("/api/booking/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId,
          creatorId,
          userId: walletAddress,
          amount: price,
          currency,
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

      if (data?.joinUrl) {
        window.location.href = data.joinUrl;
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

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={canBook ? handleBook : handleConnect}
        disabled={!ready || booking}
        className="inline-flex min-h-10 w-full sm:w-auto items-center justify-center rounded-xl px-4 py-2.5 font-semibold text-black hover:opacity-90 disabled:opacity-60 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#030305]"
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
                : `Book with ${currency}`}
      </button>
      {error && (
        <p className="max-w-xs text-sm text-red-200">
          {error}
        </p>
      )}
      <p className="text-xs text-white/45">
        {formatPaymentAmount(price, currency)}
      </p>
    </div>
  );
}
