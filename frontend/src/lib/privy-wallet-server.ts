import bs58 from "bs58";
import { PrivyClient } from "@privy-io/node";
import { Keypair } from "@solana/web3.js";

function getPrivyClient() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";
  const appSecret = process.env.PRIVY_APP_SECRET ?? "";

  if (!appId || !appSecret) {
    throw new Error("Privy server configuration is missing.");
  }

  return new PrivyClient({ appId, appSecret });
}

export function decodePrivateKey(privateKey: string): Uint8Array {
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

export async function exportPrivyWalletKey(accessToken: string, walletAddress: string) {
  const privy = getPrivyClient();
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

export async function getPrivyKeypair(accessToken: string, walletAddress: string) {
  const privateKey = await exportPrivyWalletKey(accessToken, walletAddress);
  return Keypair.fromSecretKey(decodePrivateKey(privateKey));
}
