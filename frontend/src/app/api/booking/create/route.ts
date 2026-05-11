import { prisma } from "@/lib/prisma";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { NextResponse } from "next/server";
import { getAssociatedTokenAddress, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import { deriveBookingId, findBookingEscrowPda, INTERVAL_PROGRAM_ID } from "@/lib/interval-program";
import {
  getPusdMintPublicKey,
  getSelectedSolanaNetwork,
  getSolanaRpcUrl,
  PUSD_DECIMALS,
} from "@/lib/solana-config";

type BookingRequest = {
  slotId?: string;
  creatorId?: string;
  userId?: string;
  payerWallet?: string;
  amount?: number;
  currency?: "SOL" | "PUSD";
  txSignature?: string;
  name?: string;
  email?: string;
  callFor?: string;
};

function toBaseUnits(amount: number, decimals: number) {
  return BigInt(Math.round(amount * 10 ** decimals));
}

function readProgramId(instruction: unknown) {
  if (!instruction || typeof instruction !== "object") return null;

  const value = instruction as { programId?: { toBase58?: () => string } | string };
  if (typeof value.programId === "string") {
    return value.programId;
  }

  if (value.programId && typeof value.programId.toBase58 === "function") {
    return value.programId.toBase58();
  }

  return null;
}

function readTokenTransfer(instruction: unknown) {
  if (!instruction || typeof instruction !== "object") return null;

  const value = instruction as {
    program?: string;
    parsed?: {
      type?: string;
      info?: Record<string, unknown>;
    };
  };

  if (value.program !== "spl-token" && value.program !== "spl-token-2022") return null;
  if (!value.parsed || (value.parsed.type !== "transfer" && value.parsed.type !== "transferChecked")) {
    return null;
  }

  const info = value.parsed.info ?? {};
  const source = typeof info.source === "string" ? info.source : null;
  const destination = typeof info.destination === "string" ? info.destination : null;
  const amount =
    typeof info.amount === "string"
      ? info.amount
      : typeof info.tokenAmount === "object" &&
          info.tokenAmount &&
          "amount" in info.tokenAmount &&
          typeof (info.tokenAmount as { amount?: unknown }).amount === "string"
        ? (info.tokenAmount as { amount: string }).amount
        : null;

  if (!source || !destination || !amount) {
    return null;
  }

  return { source, destination, amount };
}

async function isOwnedPusdTokenAccount({
  connection,
  tokenAccount,
  expectedOwner,
  expectedMint,
}: {
  connection: Connection;
  tokenAccount: string;
  expectedOwner: string;
  expectedMint: string;
}) {
  const accountInfo = await connection.getParsedAccountInfo(new PublicKey(tokenAccount), "confirmed");
  const value = accountInfo.value;
  if (!value || !("parsed" in value.data)) {
    return false;
  }

  const parsed = value.data.parsed as {
    info?: {
      owner?: string;
      mint?: string;
    };
  };

  return parsed.info?.owner === expectedOwner && parsed.info?.mint === expectedMint;
}

async function verifyBookingPayment({
  connection,
  network,
  slotId,
  payerWallet,
  creatorWallet,
  currency,
  amount,
  txSignature,
}: {
  connection: Connection;
  network: ReturnType<typeof getSelectedSolanaNetwork>;
  slotId: string;
  payerWallet: string;
  creatorWallet: string;
  currency: "SOL" | "PUSD";
  amount: number;
  txSignature: string;
}) {
  const tx = await connection.getParsedTransaction(txSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  if (!tx) {
    throw new Error("Payment transaction could not be found on-chain yet.");
  }

  if (tx.meta?.err) {
    throw new Error("Payment transaction failed on-chain.");
  }

  if (currency === "SOL") {
    const bookingId = await deriveBookingId(slotId, payerWallet);
    const bookingEscrow = findBookingEscrowPda(bookingId);
    const [escrowAccount] = await Promise.all([
      connection.getAccountInfo(bookingEscrow, "confirmed"),
    ]);
    const hasIntervalInstruction = tx.transaction.message.instructions.some(
      (instruction) => readProgramId(instruction) === INTERVAL_PROGRAM_ID.toBase58()
    );

    if (!hasIntervalInstruction || !escrowAccount) {
      throw new Error("SOL escrow payment could not be verified for this booking.");
    }

    return;
  }

  const pusdMint = getPusdMintPublicKey(network);
  if (!pusdMint) {
    throw new Error("PUSD is not configured for the current Solana network.");
  }

  const payer = new PublicKey(payerWallet);
  const creator = new PublicKey(creatorWallet);
  const expectedSource = (
    await getAssociatedTokenAddress(
      pusdMint,
      payer,
      false,
      TOKEN_2022_PROGRAM_ID
    )
  ).toBase58();
  const expectedDestination = (
    await getAssociatedTokenAddress(
      pusdMint,
      creator,
      false,
      TOKEN_2022_PROGRAM_ID
    )
  ).toBase58();
  const expectedAmount = toBaseUnits(amount, PUSD_DECIMALS);
  const possibleTransfers = tx.transaction.message.instructions
    .map((instruction) => readTokenTransfer(instruction))
    .filter((transfer): transfer is NonNullable<ReturnType<typeof readTokenTransfer>> => Boolean(transfer))
    .filter(
      (transfer) =>
        transfer.destination === expectedDestination &&
        BigInt(transfer.amount) >= expectedAmount
    );

  let hasMatchingTransfer = false;
  for (const transfer of possibleTransfers) {
    if (
      transfer.source === expectedSource ||
      (await isOwnedPusdTokenAccount({
        connection,
        tokenAccount: transfer.source,
        expectedOwner: payerWallet,
        expectedMint: pusdMint.toBase58(),
      }))
    ) {
      hasMatchingTransfer = true;
      break;
    }
  }

  if (!hasMatchingTransfer) {
    throw new Error("PUSD transfer to the creator wallet could not be verified.");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BookingRequest;
    const slotId = body.slotId?.trim();
    const payerWallet = (body.userId ?? body.payerWallet)?.trim();
    const txSignature = body.txSignature?.trim();

    if (!slotId || !payerWallet || !txSignature) {
      return NextResponse.json(
        { error: "slotId, userId, and txSignature are required" },
        { status: 400 }
      );
    }

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { creator: true },
    });

    if (!slot || slot.status !== "available") {
      return NextResponse.json(
        { error: "Slot not found or no longer available" },
        { status: 400 }
      );
    }

    if (new Date(slot.startTime).getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "This slot has already started and can no longer be booked." },
        { status: 400 }
      );
    }

    const amount = Number(body.amount ?? slot.price);
    const currency = body.currency ?? slot.currency;

    if (slot.creatorId !== body.creatorId && body.creatorId) {
      return NextResponse.json(
        { error: "creatorId does not match this slot" },
        { status: 400 }
      );
    }

    if (amount !== slot.price) {
      return NextResponse.json(
        { error: "Booking amount does not match the slot" },
        { status: 400 }
      );
    }

    if (currency !== slot.currency && currency !== "PUSD") {
      return NextResponse.json(
        { error: "Booking currency is not supported for this slot" },
        { status: 400 }
      );
    }

    const network = getSelectedSolanaNetwork(req.headers.get("cookie"));
    const connection = new Connection(getSolanaRpcUrl(network), "confirmed");
    await verifyBookingPayment({
      connection,
      network,
      slotId: slot.id,
      payerWallet,
      creatorWallet: slot.creator.wallet,
      currency,
      amount,
      txSignature,
    });

    const accessToken = crypto.randomUUID();
    const name = body.name?.trim() || null;
    const email = body.email?.trim() || null;
    const callFor = body.callFor?.trim() || null;

    const [booking] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          slotId: slot.id,
          creatorId: slot.creatorId,
          payerWallet,
          amountSol: currency === "SOL" ? amount : 0,
          amount,
          currency,
          txSignature,
          signature: txSignature,
          status: "confirmed",
          name,
          email,
          callFor,
          accessToken,
        },
      }),
      prisma.slot.update({
        where: { id: slot.id },
        data: { status: "booked" },
      }),
    ]);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      new URL(req.url).origin;
    const joinUrl = `${baseUrl}/booking/${booking.id}?token=${accessToken}`;

    if (email) {
      sendBookingConfirmationEmail({
        to: email,
        creatorName: slot.creator.username,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
        joinUrl,
        meetLink: slot.meetLink,
        amount,
        currency,
      }).catch((err) => console.error("Confirmation email failed:", err));
    }

    return NextResponse.json({ booking, joinUrl });
  } catch (err) {
    console.error("Create booking error:", err);
    return NextResponse.json(
      { error: "Failed to create booking" },
      { status: 500 }
    );
  }
}
