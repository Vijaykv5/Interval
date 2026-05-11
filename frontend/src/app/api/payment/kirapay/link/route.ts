import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encodeKiraReturnState } from "@/lib/kirapay-return";

type CreateKiraLinkRequest = {
  slotId?: string;
  creatorId?: string;
  creatorWallet?: string;
  payerWallet?: string;
  price?: number;
  currency?: "SOL" | "PUSD" | "USDC";
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

const USD_TO_INR_RATE_CACHE_MS = 6 * 60 * 60 * 1000;
const USD_TO_INR_RATE_FALLBACK = 85;
const SOL_TO_INR_RATE_CACHE_MS = 60 * 60 * 1000;
const SOL_TO_INR_RATE_FALLBACK = 15_000;
let usdToInrRateCache: { rate: number; expiresAt: number } | null = null;
let solToInrRateCache: { rate: number; expiresAt: number } | null = null;

function getKiraApiKey() {
  return (
    process.env.KIRA_PAY?.trim() ||
    process.env.KIRAPAY_API_KEY?.trim() ||
    process.env.KIRA_PAY_API_KEY?.trim() ||
    ""
  );
}

function getBaseUrl(req: Request) {
  const requestOrigin = new URL(req.url).origin;
  if (
    requestOrigin.includes("localhost") ||
    requestOrigin.includes("127.0.0.1")
  ) {
    return requestOrigin;
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "") ||
    requestOrigin
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

async function getUsdToInrRate() {
  const raw = process.env.KIRA_PAY_USD_TO_INR_RATE?.trim();
  const parsed = raw ? Number(raw) : null;

  if (parsed && Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  if (usdToInrRateCache && usdToInrRateCache.expiresAt > Date.now()) {
    return usdToInrRateCache.rate;
  }

  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=USD&to=INR", {
      next: { revalidate: USD_TO_INR_RATE_CACHE_MS / 1000 },
    });
    const data = (await res.json().catch(() => ({}))) as {
      rates?: { INR?: number };
    };
    const rate = data.rates?.INR;

    if (res.ok && rate && Number.isFinite(rate) && rate > 0) {
      usdToInrRateCache = {
        rate,
        expiresAt: Date.now() + USD_TO_INR_RATE_CACHE_MS,
      };
      return rate;
    }
  } catch (error) {
    console.warn("USD to INR rate fetch failed; using fallback rate.", error);
  }

  return USD_TO_INR_RATE_FALLBACK;
}

async function getSolToInrRate() {
  const raw = process.env.KIRA_PAY_SOL_TO_INR_RATE?.trim();
  const parsed = raw ? Number(raw) : null;

  if (parsed && Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }

  if (solToInrRateCache && solToInrRateCache.expiresAt > Date.now()) {
    return solToInrRateCache.rate;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=inr",
      {
        next: { revalidate: SOL_TO_INR_RATE_CACHE_MS / 1000 },
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      solana?: { inr?: number };
    };
    const rate = data.solana?.inr;

    if (res.ok && rate && Number.isFinite(rate) && rate > 0) {
      solToInrRateCache = {
        rate,
        expiresAt: Date.now() + SOL_TO_INR_RATE_CACHE_MS,
      };
      return rate;
    }
  } catch (error) {
    console.warn("SOL to INR rate fetch failed; using fallback rate.", error);
  }

  return SOL_TO_INR_RATE_FALLBACK;
}

async function deriveOriginalPrice(
  amount: number,
  fiatCurrency: string,
  currency: "SOL" | "PUSD" | "USDC"
) {
  const fixed = getFixedOriginalPrice();
  if (fixed !== null) return fixed;

  const upperCurrency = fiatCurrency.toUpperCase();
  const zeroDecimalCurrencies = new Set(["VND", "JPY", "KRW"]);

  if (upperCurrency === "INR" && (currency === "USDC" || currency === "PUSD")) {
    return Math.max(1, Math.round(amount * await getUsdToInrRate()));
  }

  if (upperCurrency === "INR" && currency === "SOL") {
    return Math.max(1, Math.round(amount * await getSolToInrRate()));
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

    const originalPrice = await deriveOriginalPrice(slot.price, fiatCurrency, slot.currency);
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
