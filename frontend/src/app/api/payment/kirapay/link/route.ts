import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encodeKiraReturnState } from "@/lib/kirapay-return";

type CreateKiraLinkRequest = {
  slotId?: string;
  creatorId?: string;
  creatorWallet?: string;
  payerWallet?: string;
  price?: number;
  currency?: "SOL" | "PUSD";
};

type KiraGenerateResponse = {
  message?: string;
  code?: number;
  data?: {
    url?: string;
    price?: number;
    originalPrice?: number;
  };
};

function getKiraApiKey() {
  return (
    process.env.KIRA_PAY?.trim() ||
    process.env.KIRAPAY_API_KEY?.trim() ||
    process.env.KIRA_PAY_API_KEY?.trim() ||
    ""
  );
}

function getBaseUrl(req: Request) {
  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    new URL(req.url).origin
  );
}

function getReceiverWallet() {
  return process.env.KIRA_PAY_RECEIVER?.trim() || "";
}

function getTokenOutAddress() {
  return process.env.KIRA_PAY_TOKEN_OUT_ADDRESS?.trim() || "";
}

function getTokenOutChainId() {
  const value = process.env.KIRA_PAY_TOKEN_OUT_CHAIN_ID?.trim() || "sol";
  return value.toLowerCase() === "solana" ? "sol" : value;
}

function getFiatCurrency() {
  return process.env.KIRA_PAY_FIAT_CURRENCY?.trim() || "INR";
}

function getPaymentType() {
  return process.env.KIRA_PAY_LINK_TYPE?.trim() || "single_use";
}

function shouldViewAsCrypto() {
  return process.env.KIRA_PAY_VIEW_AS_CRYPTO?.trim() === "true";
}

function getFixedOriginalPrice() {
  const raw = process.env.KIRA_PAY_FIXED_ORIGINAL_PRICE?.trim();
  if (!raw) return null;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveOriginalPrice(amount: number, fiatCurrency: string) {
  const fixed = getFixedOriginalPrice();
  if (fixed !== null) return fixed;

  const upperCurrency = fiatCurrency.toUpperCase();
  const zeroDecimalCurrencies = new Set(["VND", "JPY", "KRW"]);

  // Pragmatic fallback for checkout testing:
  // convert tiny SOL-denominated slot prices into a non-zero fiat checkout amount.
  if (upperCurrency === "INR") {
    return Math.max(100, Math.round(amount * 100_000));
  }

  return zeroDecimalCurrencies.has(upperCurrency)
    ? Math.max(1, Math.round(amount))
    : Math.max(1, Math.round(amount * 100));
}

export async function POST(req: Request) {
  try {
    const apiKey = getKiraApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: "KIRAPAY API key is missing. Add KIRA_PAY to .env.local." },
        { status: 500 }
      );
    }

    const body = (await req.json()) as CreateKiraLinkRequest;
    const slotId = body.slotId?.trim();
    const payerWallet = body.payerWallet?.trim();

    if (!slotId || !payerWallet) {
      return NextResponse.json(
        { error: "slotId and payerWallet are required." },
        { status: 400 }
      );
    }

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { creator: true },
    });

    if (!slot || slot.status !== "available") {
      return NextResponse.json(
        { error: "Slot not found or no longer available." },
        { status: 400 }
      );
    }

    if (new Date(slot.startTime).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This slot has already started and can no longer be booked." },
        { status: 400 }
      );
    }

    if (body.creatorId && slot.creatorId !== body.creatorId) {
      return NextResponse.json(
        { error: "creatorId does not match this slot." },
        { status: 400 }
      );
    }

    if (body.creatorWallet && slot.creator.wallet !== body.creatorWallet) {
      return NextResponse.json(
        { error: "creatorWallet does not match this slot." },
        { status: 400 }
      );
    }

    if (body.price !== undefined && Number(body.price) !== slot.price) {
      return NextResponse.json(
        { error: "Slot price does not match." },
        { status: 400 }
      );
    }

    if (body.currency && body.currency !== slot.currency) {
      return NextResponse.json(
        { error: "Slot currency does not match." },
        { status: 400 }
      );
    }

    const envReceiver = getReceiverWallet();
    const receiver = envReceiver || slot.creator.wallet;
    const tokenOutAddress = getTokenOutAddress();
    const tokenOutChainId = getTokenOutChainId();
    const fiatCurrency = getFiatCurrency();
    const type = getPaymentType();
    const isViewAsCrypto = shouldViewAsCrypto();

    if (!tokenOutAddress) {
      return NextResponse.json(
        { error: "KIRA_PAY_TOKEN_OUT_ADDRESS is missing in .env.local." },
        { status: 500 }
      );
    }

    const originalPrice = deriveOriginalPrice(slot.price, fiatCurrency);
    const customOrderId = `interval-${crypto.randomUUID()}`;

    if (originalPrice <= 0) {
      return NextResponse.json(
        {
          error:
            `KIRAPAY originalPrice resolved to ${originalPrice}. Your slot price (${slot.price}) is too small for ${fiatCurrency} settlement with the current conversion logic. Set KIRA_PAY_FIXED_ORIGINAL_PRICE if you want a specific INR checkout amount.`,
        },
        { status: 400 }
      );
    }

    const payment = await prisma.kiraPayment.create({
      data: {
        customOrderId,
        slotId: slot.id,
        creatorId: slot.creatorId,
        payerWallet,
        receiverWallet: receiver,
        originalPrice,
        fiatCurrency,
        status: "pending",
      },
    });

    const baseUrl = getBaseUrl(req);
    const returnState = encodeKiraReturnState({
      paymentId: payment.id,
    });
    const redirectUrl = `${baseUrl}/payment/kirapay/complete/${returnState}`;

    const requestBody = {
      tokenOut: {
        chainId: tokenOutChainId,
        address: tokenOutAddress,
      },
      receiver,
      originalPrice,
      fiatCurrency,
      name: `Interval booking with @${slot.creator.username}`,
      customOrderId,
      redirectUrl,
      type,
      isViewAsCrypto,
    };

    const response = await fetch("https://api.kira-pay.com/api/link/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    const data = (await response.json().catch(() => ({}))) as KiraGenerateResponse;
    const checkoutUrl = data.data?.url;

    if (!response.ok || !checkoutUrl) {
      await prisma.kiraPayment.update({
        where: { id: payment.id },
        data: {
          status: "failed",
          providerStatus: typeof data.message === "string" ? data.message : "failed",
          rawPayload: requestBody,
        },
      });

      console.error("KIRAPAY upstream error", {
        status: response.status,
        message: data.message,
        requestPreview: requestBody,
      });

      return NextResponse.json(
        {
          error:
            data.message ||
            "KIRAPAY checkout creation failed. Check your settlement config.",
        },
        { status: 400 }
      );
    }

    const checkoutCode = checkoutUrl.split("/").pop() ?? null;

    await prisma.kiraPayment.update({
      where: { id: payment.id },
      data: {
        checkoutUrl,
        checkoutCode,
        rawPayload: requestBody,
      },
    });

    return NextResponse.json({
      checkoutUrl,
      price: data.data?.price ?? null,
      originalPrice: data.data?.originalPrice ?? originalPrice,
    });
  } catch (err) {
    console.error("KIRAPAY link error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create KIRAPAY checkout." },
      { status: 500 }
    );
  }
}
