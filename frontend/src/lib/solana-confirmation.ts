import type { Commitment, Connection, SignatureStatus } from "@solana/web3.js";

const CONFIRMATION_POLL_INTERVAL_MS = 1_200;
const CONFIRMATION_TIMEOUT_MS = 60_000;

type ConfirmSignatureInput = {
  connection: Connection;
  signature: string;
  lastValidBlockHeight?: number;
  commitment?: Commitment;
  timeoutMs?: number;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasReachedCommitment(
  status: SignatureStatus | null,
  commitment: Commitment
) {
  if (!status) return false;
  if (status.err) return true;

  if (commitment === "processed") {
    return true;
  }

  if (commitment === "confirmed") {
    return status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized";
  }

  return status.confirmationStatus === "finalized";
}

export async function confirmSignatureWithPolling({
  connection,
  signature,
  lastValidBlockHeight,
  commitment = "confirmed",
  timeoutMs = CONFIRMATION_TIMEOUT_MS,
}: ConfirmSignatureInput) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const statuses = await connection.getSignatureStatuses([signature], {
      searchTransactionHistory: true,
    });
    const status = statuses.value[0];

    if (hasReachedCommitment(status, commitment)) {
      if (status?.err) {
        throw new Error(`Transaction failed to confirm: ${JSON.stringify(status.err)}`);
      }

      return status;
    }

    if (typeof lastValidBlockHeight === "number") {
      const currentBlockHeight = await connection.getBlockHeight(commitment);
      if (currentBlockHeight > lastValidBlockHeight) {
        throw new Error("Transaction expired before reaching the requested confirmation level.");
      }
    }

    await sleep(CONFIRMATION_POLL_INTERVAL_MS);
  }

  throw new Error("Transaction confirmation timed out while polling the Solana RPC.");
}
