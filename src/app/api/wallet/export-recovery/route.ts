import { PrivyClient } from "@privy-io/node";
import { NextResponse } from "next/server";

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
const appSecret = process.env.PRIVY_APP_SECRET ?? "";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;

    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      );
    }

    if (!appId || !appSecret) {
      console.error("[export-recovery] PRIVY_APP_SECRET or NEXT_PUBLIC_PRIVY_APP_ID not set");
      return NextResponse.json(
        { error: "Server configuration error. Add PRIVY_APP_SECRET to .env" },
        { status: 500 }
      );
    }

    const privy = new PrivyClient({ appId, appSecret });

    const verified = await privy.utils().auth().verifyAccessToken(accessToken);
    const userId = verified.user_id;

    const firstPage = await privy.wallets().list({
      user_id: userId,
      chain_type: "solana",
    });
    const wallets = firstPage.getPaginatedItems();
    const walletId = wallets[0]?.id ?? null;

    if (!walletId) {
      return NextResponse.json(
        { error: "No Solana wallet found for this account" },
        { status: 404 }
      );
    }

    const { private_key } = await privy.wallets().export(walletId, {
      authorization_context: { user_jwts: [accessToken] },
    });

    return NextResponse.json({ private_key });
  } catch (err: unknown) {
    const message =
      err && typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "Export failed";
    console.error("[export-recovery]", err);
    const isInvalidJwt =
      message.includes("Invalid JWT") || (message.includes("invalid") && message.includes("token"));
    if (isInvalidJwt) {
      return NextResponse.json(
        {
          error: "Server-side export is not available for your login method. Use the in-app export instead.",
          code: "use_client_export",
        },
        { status: 400 }
      );
    }
    const status =
      message.includes("invalid") || message.includes("expired") || message.includes("unauthorized") ? 401 : 500;
    const safeMessage =
      status === 500 && message.toLowerCase().includes("export")
        ? "Recovery export is not available for this wallet. Try signing out and back in, or use your wallet app to export the key."
        : message;
    return NextResponse.json({ error: safeMessage }, { status });
  }
}
