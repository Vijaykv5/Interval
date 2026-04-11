import bs58 from "bs58";
import { BagsSDK, signAndSendTransaction, waitForSlotsToPass } from "@bagsfm/bags-sdk";
import { PrivyClient } from "@privy-io/node";
import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const BAGS_BASE_URL = "https://public-api-v2.bags.fm/api/v1";

type LaunchRequestBody = {
  wallet: string;
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  website?: string | null;
  twitter?: string | null;
  telegram?: string | null;
  initialBuySol?: number;
  partner?: string | null;
  partnerConfig?: string | null;
  additionalLookupTables?: string[] | null;
  tipWallet?: string | null;
  tipLamports?: number | null;
};

type BagsSuccess<T> = {
  success: true;
  response: T;
};

type BagsError = {
  success: false;
  error?: string;
  message?: string;
  response?: string;
};

type CreateTokenInfoResponse = {
  tokenMint: string;
  tokenMetadata: string;
};

type ClientSignLaunchResponse = {
  mode: "client_sign";
  tokenMint: string;
  tokenMetadata: string;
  configKey: string;
  configTransactions: string[];
  configBundles: string[][];
  launchTransaction: string;
  bagsUrl: string;
};

type ServerSignedLaunchResponse = {
  mode: "server_signed";
  tokenMint: string;
  tokenMetadata: string;
  configKey: string;
  configSignatures: string[];
  launchSignature: string;
  bagsUrl: string;
};

function trimString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toOptionalUrl(value: unknown) {
  const trimmed = trimString(value);
  return trimmed.length > 0 ? trimmed : null;
}

function toOptionalPublicKey(value: unknown) {
  const trimmed = trimString(value);
  if (!trimmed) return null;
  return new PublicKey(trimmed);
}

function toOptionalLookupTables(value: unknown) {
  if (Array.isArray(value)) {
    const keys = value
      .map((item) => trimString(item))
      .filter(Boolean)
      .map((item) => new PublicKey(item));
    return keys.length > 0 ? keys : null;
  }

  const trimmed = trimString(value);
  if (!trimmed) return null;
  const keys = trimmed
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => new PublicKey(item));
  return keys.length > 0 ? keys : null;
}

async function bagsRequest<T>(
  path: string,
  init: RequestInit
): Promise<T> {
  const apiKey = process.env.BAGS_API_KEY;
  if (!apiKey) {
    throw new Error("BAGS_API_KEY is not configured");
  }

  const response = await fetch(`${BAGS_BASE_URL}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const rawText = await response.text();
  let payload:
    | BagsSuccess<T>
    | BagsError
    | { error?: string; message?: string; response?: string }
    | null = null;
  try {
    payload = rawText
      ? (JSON.parse(rawText) as
          | BagsSuccess<T>
          | BagsError
          | { error?: string; message?: string; response?: string })
      : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload || !("success" in payload) || !payload.success) {
    const message =
      payload && "error" in payload && payload.error
        ? payload.error
        : payload && "message" in payload && payload.message
          ? payload.message
          : payload && "response" in payload && typeof payload.response === "string"
            ? payload.response
          : rawText || `Bags request failed (${response.status})`;
    console.error("Bags API error", {
      path,
      status: response.status,
      body: rawText,
    });
    throw new Error(message);
  }

  return payload.response;
}

function assertValidSolanaWallet(wallet: string) {
  try {
    new PublicKey(wallet);
  } catch {
    throw new Error("Creator wallet is not a valid Solana address.");
  }
}

function decodePrivateKey(privateKey: string): Uint8Array {
  const trimmed = privateKey.trim();

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return Uint8Array.from(JSON.parse(trimmed) as number[]);
  }

  try {
    return bs58.decode(trimmed);
  } catch {
    return Uint8Array.from(Buffer.from(trimmed, "base64"));
  }
}

async function exportPrivyWalletKey(accessToken: string, walletAddress: string) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  const appSecret = process.env.PRIVY_APP_SECRET ?? "";
  if (!appId || !appSecret) {
    throw new Error("Privy server configuration is missing.");
  }

  const privy = new PrivyClient({ appId, appSecret });
  const verified = await privy.utils().auth().verifyAccessToken(accessToken);

  const firstPage = await privy.wallets().list({
    user_id: verified.user_id,
    chain_type: "solana",
  });
  const wallets = firstPage.getPaginatedItems();
  const targetWallet = wallets.find((item) => item.address === walletAddress);

  if (!targetWallet?.id) {
    throw new Error("No matching Solana wallet found for this account.");
  }

  const { private_key } = await privy.wallets().export(targetWallet.id, {
    authorization_context: { user_jwts: [accessToken] },
  });

  if (!private_key) {
    throw new Error("Privy did not return a private key for this wallet.");
  }

  return private_key;
}

function isPrivyJwtExportError(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes("invalid jwt") ||
    message.includes("invalid token") ||
    message.includes("invalid jwt token")
  );
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function getErrorMeta(error: unknown) {
  if (!error || typeof error !== "object") return null;
  const maybe = error as {
    status?: number;
    url?: string;
    method?: string;
    data?: unknown;
    message?: string;
  };
  return {
    status: maybe.status,
    url: maybe.url,
    method: maybe.method,
    data: maybe.data,
    message: maybe.message,
  };
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const accessToken = authHeader?.startsWith("Bearer ")
      ? authHeader.slice(7)
      : null;
    const body = (await req.json()) as LaunchRequestBody;
    const wallet = trimString(body.wallet);
    const name = trimString(body.name);
    const symbol = trimString(body.symbol).replace(/^\$/, "").toUpperCase();
    const description = trimString(body.description);
    const imageUrl = trimString(body.imageUrl);
    const website = toOptionalUrl(body.website);
    const twitter = toOptionalUrl(body.twitter);
    const telegram = toOptionalUrl(body.telegram);
    const initialBuySol =
      typeof body.initialBuySol === "number" && Number.isFinite(body.initialBuySol)
        ? body.initialBuySol
        : 0.01;
    const partner =
      toOptionalPublicKey(body.partner) ??
      toOptionalPublicKey(process.env.BAGS_PARTNER_WALLET);
    const partnerConfig =
      toOptionalPublicKey(body.partnerConfig) ??
      toOptionalPublicKey(process.env.BAGS_PARTNER_CONFIG);
    const additionalLookupTables =
      toOptionalLookupTables(body.additionalLookupTables) ??
      toOptionalLookupTables(process.env.BAGS_ADDITIONAL_LOOKUP_TABLES);
    const tipWallet =
      toOptionalPublicKey(body.tipWallet) ??
      toOptionalPublicKey(process.env.BAGS_TIP_WALLET);
    const tipLamports =
      typeof body.tipLamports === "number" && Number.isFinite(body.tipLamports)
        ? body.tipLamports
        : process.env.BAGS_TIP_LAMPORTS
          ? Number(process.env.BAGS_TIP_LAMPORTS)
          : null;
    const apiKey = process.env.BAGS_API_KEY;

    if (!wallet) {
      return NextResponse.json({ error: "wallet is required" }, { status: 400 });
    }
    if (!accessToken) {
      return NextResponse.json(
        { error: "Missing Privy access token." },
        { status: 401 }
      );
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: "BAGS_API_KEY is not configured" },
        { status: 500 }
      );
    }

    assertValidSolanaWallet(wallet);
    if (!name || name.length > 32) {
      return NextResponse.json(
        { error: "name is required and must be 32 characters or less" },
        { status: 400 }
      );
    }
    if (!symbol || symbol.length > 10) {
      return NextResponse.json(
        { error: "symbol is required and must be 10 characters or less" },
        { status: 400 }
      );
    }
    if (!description || description.length > 1000) {
      return NextResponse.json(
        { error: "description is required and must be 1000 characters or less" },
        { status: 400 }
      );
    }
    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }
    if (initialBuySol < 0) {
      return NextResponse.json(
        { error: "initialBuySol must be 0 or greater" },
        { status: 400 }
      );
    }

    const rpcUrl =
      process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const sdk = new BagsSDK(apiKey, connection, "confirmed");

    const launchWallet = new PublicKey(wallet);
    let tokenInfo: CreateTokenInfoResponse;
    try {
      tokenInfo = await sdk.tokenLaunch.createTokenInfoAndMetadata({
        name,
        symbol,
        description,
        imageUrl,
        website: website ?? undefined,
        twitter: twitter ?? undefined,
        telegram: telegram ?? undefined,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create token metadata";
      throw new Error(message);
    }

    let configTransactions: Awaited<ReturnType<typeof sdk.config.createBagsFeeShareConfig>>;
    try {
      configTransactions = await sdk.config.createBagsFeeShareConfig({
        payer: launchWallet,
        baseMint: new PublicKey(tokenInfo.tokenMint),
        partner: partner ?? undefined,
        partnerConfig: partnerConfig ?? undefined,
        additionalLookupTables: additionalLookupTables ?? undefined,
        feeClaimers: [
          {
            user: launchWallet,
            userBps: 10000,
          },
        ],
      }, tipWallet && tipLamports != null ? {
        tipWallet,
        tipLamports,
      } : undefined);
    } catch (error) {
      console.error("Bags fee share config creation failed", getErrorMeta(error));
      return NextResponse.json(
        {
          error: getErrorMessage(error, "Failed to create Bags fee share config"),
          stage: "create_bags_fee_share_config",
          details: getErrorMeta(error),
          requestShape: {
            payer: wallet,
            baseMint: tokenInfo.tokenMint,
            claimersArray: [wallet],
            basisPointsArray: [10000],
            partner: partner?.toBase58() ?? null,
            partnerConfig: partnerConfig?.toBase58() ?? null,
            additionalLookupTables: additionalLookupTables?.map((key) => key.toBase58()) ?? [],
            tipWallet: tipWallet?.toBase58() ?? null,
            tipLamports: tipLamports ?? null,
          },
        },
        { status: 500 }
      );
    }

    const initialBuyLamports = Math.floor(initialBuySol * 1_000_000_000);

    let launchTransaction;
    try {
      launchTransaction = await sdk.tokenLaunch.createLaunchTransaction({
        metadataUrl: tokenInfo.tokenMetadata,
        tokenMint: new PublicKey(tokenInfo.tokenMint),
        launchWallet,
        initialBuyLamports,
        configKey: configTransactions.meteoraConfigKey,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create launch transaction";
      throw new Error(message);
    }

    let launchKeypair: Keypair | null = null;
    try {
      const exportedPrivateKey = await exportPrivyWalletKey(accessToken, wallet);
      launchKeypair = Keypair.fromSecretKey(decodePrivateKey(exportedPrivateKey));
    } catch (error) {
      if (!isPrivyJwtExportError(error)) {
        throw error;
      }
    }

    if (!launchKeypair) {
      const clientResponse: ClientSignLaunchResponse = {
        mode: "client_sign",
        tokenMint: tokenInfo.tokenMint,
        tokenMetadata: tokenInfo.tokenMetadata,
        configKey: configTransactions.meteoraConfigKey.toBase58(),
        configTransactions: configTransactions.transactions.map((transaction) =>
          bs58.encode(transaction.serialize())
        ),
        configBundles: configTransactions.bundles.map((bundle) =>
          bundle.map((transaction) => bs58.encode(transaction.serialize()))
        ),
        launchTransaction: bs58.encode(launchTransaction.serialize()),
        bagsUrl: `https://bags.fm/${tokenInfo.tokenMint}`,
      };
      return NextResponse.json(clientResponse);
    }

    const configSignatures: string[] = [];
    for (const transaction of configTransactions.transactions) {
      const signature = await signAndSendTransaction(
        connection,
        "confirmed",
        transaction,
        launchKeypair
      );
      configSignatures.push(signature);
    }

    if (configTransactions.bundles.length > 0) {
      throw new Error(
        "Bags returned bundled config transactions. This flow currently supports the standard non-bundled creator launch."
      );
    }

    await waitForSlotsToPass(connection, "confirmed", 2);

    const launchSignature = await signAndSendTransaction(
      connection,
      "confirmed",
      launchTransaction,
      launchKeypair
    );

    const serverResponse: ServerSignedLaunchResponse = {
      mode: "server_signed",
      tokenMint: tokenInfo.tokenMint,
      tokenMetadata: tokenInfo.tokenMetadata,
      configKey: configTransactions.meteoraConfigKey.toBase58(),
      configSignatures,
      launchSignature,
      bagsUrl: `https://bags.fm/${tokenInfo.tokenMint}`,
    };

    return NextResponse.json(serverResponse);
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error ? error.message : "Failed to prepare Bags launch";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
