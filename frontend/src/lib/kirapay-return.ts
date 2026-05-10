export type KiraReturnState = {
  paymentId: string;
};

export function encodeKiraReturnState(state: KiraReturnState) {
  return Buffer.from(JSON.stringify(state), "utf8").toString("base64url");
}

export function decodeKiraReturnState(value: string): KiraReturnState | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<KiraReturnState>;

    if (
      typeof parsed.paymentId !== "string"
    ) {
      return null;
    }

    return {
      paymentId: parsed.paymentId,
    };
  } catch {
    return null;
  }
}
