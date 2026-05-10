import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decodeKiraReturnState } from "@/lib/kirapay-return";

type RouteProps = {
  params: Promise<{
    state: string;
  }>;
};

export async function GET(_req: Request, { params }: RouteProps) {
  try {
    const { state } = await params;
    const decoded = decodeKiraReturnState(state);

    if (!decoded) {
      return NextResponse.json(
        { error: "Invalid payment state." },
        { status: 400 }
      );
    }

    const payment = await prisma.kiraPayment.findUnique({
      where: { id: decoded.paymentId },
    });

    if (!payment) {
      return NextResponse.json(
        { error: "Payment record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: payment.status,
      bookingId: payment.bookingId,
      providerStatus: payment.providerStatus,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load payment status." },
      { status: 500 }
    );
  }
}
