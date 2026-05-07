import {
  Keypair,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

const LP_AGENT_BASE_URL = "https://api.lpagent.io/open-api/v1";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export class LpAgentRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "LpAgentRequestError";
    this.status = status;
  }
}

export async function lpAgentRequest<T>(
  method: string,
  path: string,
  body?: JsonValue | Record<string, unknown>
): Promise<T> {
  const apiKey =
    process.env.LP_AGENT_API?.trim() ||
    process.env.LP_AGENT_API_KEY?.trim() ||
    "";

  if (!apiKey) {
    throw new Error("LP Agent API key is not configured.");
  }

  const res = await fetch(`${LP_AGENT_BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  const raw = await res.text();
  let payload: unknown = null;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && payload !== null && "message" in payload && typeof payload.message === "string"
        ? payload.message
        : payload && typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : raw || `LP Agent request failed (${res.status})`;
    throw new LpAgentRequestError(message, res.status);
  }

  return payload as T;
}

export function signBase64Transaction(base64Tx: string, wallet: Keypair): string {
  const buffer = Buffer.from(base64Tx, "base64");

  try {
    const tx = VersionedTransaction.deserialize(buffer);
    tx.sign([wallet]);
    return Buffer.from(tx.serialize()).toString("base64");
  } catch {
    const tx = Transaction.from(buffer);
    tx.partialSign(wallet);
    return tx
      .serialize({ requireAllSignatures: false, verifySignatures: false })
      .toString("base64");
  }
}

export function signBase64Transactions(transactions: string[] | undefined, wallet: Keypair) {
  return (transactions ?? []).map((tx) => signBase64Transaction(tx, wallet));
}
