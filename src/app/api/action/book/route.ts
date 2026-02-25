import {
  createActionHeaders,
  createPostResponse,
  type ActionGetResponse,
  type ActionPostRequest,
  type ActionError,
} from "@solana/actions";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from "@solana/web3.js";
import { MEMO_PROGRAM_ID } from "@solana/actions";
import { prisma } from "@/lib/prisma";
import { ACTION_ICON_FALLBACK } from "@/lib/constants";
import { sendBookingConfirmationEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const chainId = process.env.SOLANA_NETWORK ?? "devnet";
const actionVersion = "1";

const headers = createActionHeaders({
  chainId,
  actionVersion,
});

function disabledAction(
  _req: Request,
  description: string,
  label: string,
  icon = ACTION_ICON_FALLBACK
): Response {
  const payload: ActionGetResponse = {
    type: "action",
    icon,
    title: "Book meeting slot",
    description,
    label,
    disabled: true,
  };
  return Response.json(payload, { status: 200, headers });
}

/** Icon URL for blink: use creator's PFP */
function getActionIcon(
  slotId: string,
  slot: { creator: { profileImageUrl: string | null } } | null,
  baseUrl: string
): string {
  const isPublicBase =
    baseUrl.startsWith("https://") && !baseUrl.includes("localhost");
  if (!isPublicBase || !slot) return ACTION_ICON_FALLBACK;
  const url = slot.creator.profileImageUrl?.trim();
  if (!url) return ACTION_ICON_FALLBACK;
  // Use creator's Cloudinary (or any external) image directly so blinks show their PFP
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url;
  }
  const origin = baseUrl.trim().replace(/\/$/, "");
  return `${origin}/api/action/book/icon?slotId=${encodeURIComponent(slotId)}`;
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get("slotId");

    if (!slotId) {
      return disabledAction(
        req,
        "slotId is required in the URL.",
        "Missing slotId"
      );
    }

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { creator: true },
    });

    if (!slot) {
      return disabledAction(
        req,
        "This slot was not found.",
        "Slot not found"
      );
    }

    if (slot.status !== "available") {
      const requestUrlUnav = new URL(req.url);
      const baseUrlUnav = (
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
        requestUrlUnav.origin
      ).trim().replace(/\/$/, "");
      return Response.json(
        {
          type: "action",
          icon: getActionIcon(slotId, slot, baseUrlUnav),
          title: "Book meeting slot",
          description: `This slot is no longer available (${slot.status}).`,
          label: "Slot unavailable",
          disabled: true,
        } satisfies ActionGetResponse,
        { headers }
      );
    }

    const dateTimeOptions: Intl.DateTimeFormatOptions = {
      month: "numeric",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    };
    const start = new Date(slot.startTime).toLocaleString("en-US", dateTimeOptions);
    const end = new Date(slot.endTime).toLocaleString("en-US", dateTimeOptions);

    const priceLabel =
      slot.price % 1 === 0 ? slot.price.toString() : slot.price.toFixed(2);
    const description = `Book a call with ${slot.creator.username}. ${start} – ${end}. Price: ${priceLabel} SOL.`;

    const requestUrl = new URL(req.url);
    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      requestUrl.origin
    ).trim().replace(/\/$/, "");
    const actionHref = `${baseUrl}${requestUrl.pathname}${requestUrl.search}`;

    const payload: ActionGetResponse = {
      type: "action",
      icon: getActionIcon(slotId, slot, baseUrl),
      title: "Book meeting slot",
      description,
      label: `Book for ${priceLabel} SOL`,
      links: {
        actions: [
          {
            type: "transaction",
            href: actionHref,
            label: `Book for ${priceLabel} SOL`,
            parameters: [
              { name: "name", label: "Your name", type: "text", required: true, layout: "row" },
              { name: "email", label: "Email", type: "email", required: true, layout: "row" },
              { name: "callFor", label: "What's the call for?", type: "textarea", required: false },
            ] as ActionGetResponse["links"] extends { actions: Array<{ parameters?: infer P }> } ? P : never,
          },
        ],
      },
    };

    return Response.json(payload, { headers });
  } catch (err) {
    console.error(err);
    return disabledAction(
      req,
      "An unknown error occurred. Please try again.",
      "Error"
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers });
}

export async function POST(req: Request) {
  let body: ActionPostRequest;
  try {
    const raw = await req.json();
    if (!raw || typeof raw !== "object" || typeof raw.account !== "string") {
      return Response.json(
        { message: 'Invalid body: "account" (wallet) is required' } satisfies ActionError,
        { status: 400, headers }
      );
    }
    body = raw as ActionPostRequest;
  } catch {
    return Response.json(
      { message: "Invalid JSON body" } satisfies ActionError,
      { status: 400, headers }
    );
  }

  try {
    const requestUrl = new URL(req.url);
    const slotId = requestUrl.searchParams.get("slotId");

    if (!slotId) {
      return Response.json(
        { message: "slotId is required" } satisfies ActionError,
        { status: 400, headers }
      );
    }

    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { creator: true },
    });

    if (!slot || slot.status !== "available") {
      return Response.json(
        { message: "Slot not found or not available" } satisfies ActionError,
        { status: 400, headers }
      );
    }

    let account: PublicKey;
    try {
      account = new PublicKey(body.account);
    } catch {
      return Response.json(
        { message: 'Invalid "account" (wallet) provided' } satisfies ActionError,
        { status: 400, headers }
      );
    }

    const rpcUrl = process.env.SOLANA_RPC ?? clusterApiUrl("devnet");
    const connection = new Connection(rpcUrl);

    const creatorWallet = new PublicKey(slot.creator.wallet);
    const lamports = Math.floor(slot.price * LAMPORTS_PER_SOL);

    if (lamports <= 0) {
      return Response.json(
        { message: "Invalid slot price" } satisfies ActionError,
        { status: 400, headers }
      );
    }

    const data = (body.data ?? {}) as Record<string, string | string[] | undefined>;
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const callFor = typeof data.callFor === "string" ? data.callFor.trim() : "";

    const transferIx = SystemProgram.transfer({
      fromPubkey: account,
      toPubkey: creatorWallet,
      lamports,
    });

    const memoParts: string[] = [
      `Book slot ${slotId}`,
      `Creator: ${slot.creator.username}`,
    ];
    if (name) memoParts.push(`Name: ${name}`);
    if (email) memoParts.push(`Email: ${email}`);
    if (callFor) memoParts.push(`Purpose: ${callFor}`);
    const memoText = memoParts.join(" | ");
    const memoIx = new TransactionInstruction({
      keys: [],
      programId: new PublicKey(MEMO_PROGRAM_ID),
      data: Buffer.from(memoText, "utf8"),
    });

    const accessToken = crypto.randomUUID();

    const [booking] = await prisma.$transaction([
      prisma.booking.create({
        data: {
          slotId: slot.id,
          creatorId: slot.creatorId,
          payerWallet: account.toBase58(),
          amountSol: slot.price,
          name: name || null,
          email: email || null,
          callFor: callFor || null,
          accessToken,
        },
      }),
      prisma.slot.update({
        where: { id: slot.id },
        data: { status: "booked" },
      }),
    ]);

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash("confirmed");

    const transaction = new Transaction({
      feePayer: account,
      blockhash,
      lastValidBlockHeight,
    })
      .add(transferIx)
      .add(memoIx);

    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (requestUrl.origin.startsWith("http") ? requestUrl.origin : `https://${requestUrl.host}`);
    const joinUrl = `${baseUrl}/booking/${booking.id}?token=${accessToken}`;
    const meetMsg = slot.meetLink
      ? ` After signing, open this link to join your meeting: ${joinUrl}`
      : "";

    if (email) {
      sendBookingConfirmationEmail({
        to: email,
        creatorName: slot.creator.username,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
        joinUrl,
        meetLink: slot.meetLink,
        amountSol: slot.price,
      }).catch((err) => console.error("Confirmation email failed:", err));
    }

    const payload = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: `Pay ${slot.price} SOL to book slot with ${slot.creator.username}.${meetMsg}`,
      },
    });

    return Response.json(payload, { status: 200, headers });
  } catch (err) {
    console.error(err);
    return Response.json(
      { message: "An unknown error occurred" } satisfies ActionError,
      { status: 500, headers }
    );
  }
}
