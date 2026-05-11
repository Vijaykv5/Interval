import type { Booking, Creator, Slot } from "@prisma/client";
import type { Payments } from "dodopayments/resources/payments";
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { sendBookingConfirmationEmail } from "@/lib/email";
import { decodePrivateKey } from "@/lib/privy-wallet-server";
import { prisma } from "@/lib/prisma";
import { confirmSignatureWithPolling } from "@/lib/solana-confirmation";
import {
  getSelectedSolanaNetwork,
  getSolanaRpcUrl,
  getUsdcTokenDefinition,
} from "@/lib/solana-config";

type SlotWithCreator = Slot & {
  creator: Creator;
};

function getStringValue(
  metadata: Record<string, string> | undefined,
  key: string
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getNumberValue(
  metadata: Record<string, string> | undefined,
  key: string
) {
  const raw = getStringValue(metadata, key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function getBaseUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "").replace(/\/$/, "");
}

function toBaseUnits(amount: number, decimals: number) {
  return BigInt(Math.round(amount * 10 ** decimals));
}

function getAdminKeypair() {
  const secret =
    process.env.INTERVAL_PLATFORM_ADMIN_SECRET_KEY?.trim() ||
    process.env.INTERVAL_PLATFORM_ADMIN_PRIVATE_KEY?.trim() ||
    "";

  if (!secret) {
    throw new Error(
      "Platform admin secret key is missing. Set INTERVAL_PLATFORM_ADMIN_SECRET_KEY."
    );
  }

  return Keypair.fromSecretKey(decodePrivateKey(secret));
}

async function sendAndConfirm(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[]
) {
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");
  transaction.recentBlockhash = blockhash;
  transaction.sign(...signers);

  const signature = await connection.sendRawTransaction(transaction.serialize());
  await confirmSignatureWithPolling({
    connection,
    signature,
    lastValidBlockHeight,
    commitment: "confirmed",
  });

  return signature;
}

async function settleDodoUsdcPayout(slot: SlotWithCreator, booking: Booking) {
  if (booking.currency !== "USDC") {
    return booking;
  }

  if (booking.txSignature) {
    return booking;
  }

  const network = getSelectedSolanaNetwork();
  const tokenDefinition = getUsdcTokenDefinition(network);
  if (!tokenDefinition) {
    throw new Error(`USDC is not configured for ${network}.`);
  }

  const connection = new Connection(getSolanaRpcUrl(network), "confirmed");
  const admin = getAdminKeypair();
  const mint = new PublicKey(tokenDefinition.mintAddress);
  const creator = new PublicKey(slot.creator.wallet);
  const adminAta = await getAssociatedTokenAddress(
    mint,
    admin.publicKey,
    false,
    tokenDefinition.tokenProgram
  );
  const creatorAta = await getAssociatedTokenAddress(
    mint,
    creator,
    false,
    tokenDefinition.tokenProgram
  );
  const [adminAtaInfo, creatorAtaInfo] = await Promise.all([
    connection.getAccountInfo(adminAta, "confirmed"),
    connection.getAccountInfo(creatorAta, "confirmed"),
  ]);

  if (!adminAtaInfo) {
    throw new Error(
      "Platform USDC treasury account is missing. Fund the admin wallet's USDC ATA before accepting Dodo bookings."
    );
  }

  const transaction = new Transaction();
  if (!creatorAtaInfo) {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        admin.publicKey,
        creatorAta,
        creator,
        mint,
        tokenDefinition.tokenProgram
      )
    );
  }

  transaction.add(
    createTransferInstruction(
      adminAta,
      creatorAta,
      admin.publicKey,
      toBaseUnits(booking.amount, tokenDefinition.decimals),
      [],
      tokenDefinition.tokenProgram
    )
  );
  transaction.feePayer = admin.publicKey;

  const payoutSignature = await sendAndConfirm(connection, transaction, [admin]);

  return prisma.booking.update({
    where: { id: booking.id },
    data: { txSignature: payoutSignature },
  });
}

async function sendConfirmation(slot: SlotWithCreator, booking: Booking) {
  if (!booking.email) return;
  const baseUrl = getBaseUrl();
  if (!baseUrl) return;

  const joinUrl = `${baseUrl}/booking/${booking.id}?token=${booking.accessToken}`;

  await sendBookingConfirmationEmail({
    to: booking.email,
    creatorName: slot.creator.username,
    startTime: new Date(slot.startTime),
    endTime: new Date(slot.endTime),
    joinUrl,
    meetLink: slot.meetLink,
    amount: booking.amount,
    currency: booking.currency,
  });
}

export async function finalizeDodoBookingPayment(payment: Payments.Payment) {
  const metadata = payment.metadata ?? {};
  if (getStringValue(metadata, "interval_flow") !== "booking") {
    return null;
  }

  const slotId = getStringValue(metadata, "interval_slot_id");
  const creatorId = getStringValue(metadata, "interval_creator_id");
  const payerWallet = getStringValue(metadata, "interval_payer_wallet");
  const currency = getStringValue(metadata, "interval_currency");
  const amount = getNumberValue(metadata, "interval_amount");
  const name = getStringValue(metadata, "interval_name");
  const email = getStringValue(metadata, "interval_email");
  const callFor = getStringValue(metadata, "interval_call_for");

  if (!slotId || !creatorId || !payerWallet || !currency || amount === null) {
    throw new Error("Dodo booking payment metadata is incomplete.");
  }

  const normalizedCurrency =
    currency === "SOL" || currency === "PUSD" || currency === "USDC"
      ? currency
      : "PUSD";

  const slot = await prisma.slot.findUnique({
    where: { id: slotId },
    include: { creator: true },
  });

  if (!slot || slot.creatorId !== creatorId) {
    throw new Error("Slot linked to this Dodo payment was not found.");
  }

  const booking = await prisma.$transaction(async (tx) => {
    const existingByPayment = await tx.booking.findFirst({
      where: { signature: payment.payment_id },
    });
    if (existingByPayment) {
      return existingByPayment;
    }

    const existingBooking = await tx.booking.findUnique({
      where: { slotId },
    });
    if (existingBooking) {
      return existingBooking;
    }

    const currentSlot = await tx.slot.findUnique({
      where: { id: slotId },
    });

    if (!currentSlot || currentSlot.status !== "available") {
      throw new Error("This slot is no longer available.");
    }

    const accessToken = crypto.randomUUID();

    const createdBooking = await tx.booking.create({
      data: {
        slotId,
        creatorId,
        payerWallet,
        amountSol: normalizedCurrency === "SOL" ? amount : 0,
        amount,
        currency: normalizedCurrency,
        txSignature: null,
        signature: payment.payment_id,
        status: "confirmed",
        name,
        email,
        callFor,
        accessToken,
      },
    });

    await tx.slot.update({
      where: { id: slotId },
      data: { status: "booked" },
    });

    return createdBooking;
  });

  const settledBooking = await settleDodoUsdcPayout(slot, booking);

  if (settledBooking.signature === payment.payment_id) {
    void sendConfirmation(slot, booking).catch((error) => {
      console.error("Dodo booking email failed:", error);
    });
  }

  return settledBooking;
}
