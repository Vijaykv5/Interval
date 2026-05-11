import { NextResponse } from "next/server";
import { createDodoClient } from "@/lib/dodo-payments.server";
import { finalizeDodoBookingPayment } from "@/lib/dodo-bookings.server";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const paymentId = searchParams.get("paymentId")?.trim();

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required." },
        { status: 400 }
      );
    }

    const dodo = createDodoClient();
    const payment = await dodo.payments.retrieve(paymentId);
    const normalizedStatus = payment.status ?? "processing";

    const booking =
      normalizedStatus === "succeeded"
        ? await finalizeDodoBookingPayment(payment)
        : null;

    return NextResponse.json({
      status: normalizedStatus,
      bookingId: booking?.id ?? null,
    });
  } catch (error) {
    console.error("Dodo booking status error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to load Dodo payment status.",
      },
      { status: 500 }
    );
  }
}
