"use client";

export async function completeCreatorAccess(wallet: string) {
  const response = await fetch("/api/auth/creator-access", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ wallet }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "Could not complete creator access."
    );
  }

  return data;
}
