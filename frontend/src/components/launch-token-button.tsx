"use client";

import { useMemo, useState } from "react";
import bs58 from "bs58";
import { toast } from "sonner";
import { usePrivy } from "@privy-io/react-auth";
import { useSignAndSendTransaction, useWallets } from "@privy-io/react-auth/solana";
import { SOLANA_WALLET_CHAIN } from "@/lib/solana-config";

type LaunchTokenButtonProps = {
  creatorUsername: string;
  creatorWallet: string;
  creatorBio: string | null;
  creatorImageUrl: string | null;
  creatorXAccount: string | null;
  profileUrl: string;
  existingTokenMint?: string | null;
  existingTokenName?: string | null;
  existingTokenSymbol?: string | null;
  existingTokenUrl?: string | null;
  onLaunchSuccess?: (token: {
    mint: string;
    name: string;
    symbol: string;
    url: string;
    launchedAt: string;
  }) => void | Promise<void>;
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

type LaunchPreparationResponse = ClientSignLaunchResponse | ServerSignedLaunchResponse;

function isLaunchPreparationResponse(
  value: LaunchPreparationResponse | { error?: string } | null
): value is LaunchPreparationResponse {
  return Boolean(value && "mode" in value && "bagsUrl" in value);
}

function normalizeXUrl(value: string | null) {
  if (!value) return "";
  const trimmed = value.trim().replace(/^@/, "");
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://x.com/${trimmed}`;
}

export function LaunchTokenButton({
  creatorUsername,
  creatorWallet,
  creatorBio,
  creatorImageUrl,
  creatorXAccount,
  profileUrl,
  existingTokenMint,
  existingTokenName,
  existingTokenSymbol,
  existingTokenUrl,
  onLaunchSuccess,
}: LaunchTokenButtonProps) {
  const { authenticated, login, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { signAndSendTransaction } = useSignAndSendTransaction();
  const wallet = wallets[0];
  const walletAddress = wallet?.address ?? null;
  const isOwner = walletAddress === creatorWallet;

  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState(`${creatorUsername.toUpperCase()} Token`);
  const [symbol, setSymbol] = useState(creatorUsername.slice(0, 6).toUpperCase());
  const [description, setDescription] = useState(
    creatorBio?.trim() || `Official token for @${creatorUsername} on Interval.`
  );
  const [imageUrl, setImageUrl] = useState(creatorImageUrl ?? "");
  const [website, setWebsite] = useState(profileUrl);
  const [twitter, setTwitter] = useState(normalizeXUrl(creatorXAccount));
  const [initialBuySol, setInitialBuySol] = useState("0.01");
  const hasExistingToken = Boolean(existingTokenMint && existingTokenUrl);

  const helperText = useMemo(() => {
    if (!authenticated) return "Connect your wallet to launch a token.";
    if (!isOwner) return "Only the creator wallet can launch from this page.";
    if (hasExistingToken) return "This creator already has a launched Bags token.";
    return "Launch this creator token on Bags using your connected wallet.";
  }, [authenticated, hasExistingToken, isOwner]);

  async function handleLaunch() {
    if (!walletAddress || !wallet) {
      login();
      return;
    }
    if (!isOwner) {
      toast.error("Connect with the creator wallet for this profile.");
      return;
    }
    if (hasExistingToken) {
      toast.error("This creator already has a launched token.");
      return;
    }

    setSubmitting(true);
    try {
      const initialBuy = Number(initialBuySol);
      if (!Number.isFinite(initialBuy) || initialBuy < 0) {
        throw new Error("Initial buy must be a valid SOL amount.");
      }

      const response = await fetch("/api/bags/launch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getAccessToken()}`,
        },
        body: JSON.stringify({
          wallet: walletAddress,
          name,
          symbol,
          description,
          imageUrl,
          website,
          twitter,
          initialBuySol: initialBuy,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | LaunchPreparationResponse
        | { error?: string }
        | null;

      if (!response.ok || !isLaunchPreparationResponse(data)) {
        throw new Error(
          data && "error" in data && data.error
            ? data.error
            : "Failed to prepare launch transaction."
        );
      }

      if (data.mode === "client_sign") {
        for (const transaction of data.configTransactions) {
          await signAndSendTransaction({
            transaction: bs58.decode(transaction),
            wallet,
            chain: SOLANA_WALLET_CHAIN,
          });
        }

        if (data.configBundles.length > 0) {
          throw new Error(
            "This launch returned bundled config transactions. The current UI supports the standard single-wallet launch flow only."
          );
        }

        await signAndSendTransaction({
          transaction: bs58.decode(data.launchTransaction),
          wallet,
          chain: SOLANA_WALLET_CHAIN,
        });
      }

      const launchedAt = new Date().toISOString();
      await fetch("/api/creator", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wallet: creatorWallet,
          launchedTokenMint: data.tokenMint,
          launchedTokenName: name.trim(),
          launchedTokenSymbol: symbol.trim(),
          launchedTokenUrl: data.bagsUrl,
          launchedTokenAt: launchedAt,
        }),
      });

      await onLaunchSuccess?.({
        mint: data.tokenMint,
        name: name.trim(),
        symbol: symbol.trim(),
        url: data.bagsUrl,
        launchedAt,
      });

      toast.success("Token launched on Bags.");
      setOpen(false);
      window.open(data.bagsUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Token launch failed.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => {
            if (!authenticated) {
              login();
              return;
            }
            setOpen(true);
          }}
          disabled={hasExistingToken}
          className="px-4 py-2.5 rounded-xl font-semibold text-black hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60 disabled:pointer-events-none"
          style={{ backgroundColor: "#ffd28e" }}
        >
          {hasExistingToken ? "Token launched" : "Launch token"}
        </button>
        <p className="text-xs text-white/45 text-right max-w-56">{helperText}</p>
        {hasExistingToken && existingTokenUrl && (
          <a
            href={existingTokenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#ffd28e] hover:opacity-90"
          >
            View {existingTokenSymbol ? `$${existingTokenSymbol}` : existingTokenName ?? "token"} →
          </a>
        )}
      </div>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            aria-hidden
            onClick={() => !submitting && setOpen(false)}
          />
          <div className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-xl -translate-y-1/2 rounded-3xl border border-white/10 bg-[#0d0d0f] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-white/50">Bags launch</p>
                <h3 className="text-2xl font-bold text-white mt-1">
                  Launch token for @{creatorUsername}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => !submitting && setOpen(false)}
                className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                aria-label="Close"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
              <label className="block">
                <span className="block text-sm text-white/70 mb-1.5">Name</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={32}
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>

              <label className="block">
                <span className="block text-sm text-white/70 mb-1.5">Symbol</span>
                <input
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase().replace(/\s+/g, ""))}
                  maxLength={10}
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="block text-sm text-white/70 mb-1.5">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-white/25 resize-none"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="block text-sm text-white/70 mb-1.5">Image URL</span>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>

              <label className="block">
                <span className="block text-sm text-white/70 mb-1.5">Website</span>
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>

              <label className="block">
                <span className="block text-sm text-white/70 mb-1.5">X URL</span>
                <input
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                  placeholder="https://x.com/..."
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>

              <label className="block sm:col-span-2">
                <span className="block text-sm text-white/70 mb-1.5">Initial buy (SOL)</span>
                <input
                  value={initialBuySol}
                  onChange={(e) => setInitialBuySol(e.target.value)}
                  inputMode="decimal"
                  className="w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-white placeholder-white/35 focus:outline-none focus:ring-2 focus:ring-white/25"
                />
              </label>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-sm text-white/50">
                This signs Bags mainnet transactions with the connected creator wallet.
              </p>
              <button
                type="button"
                onClick={handleLaunch}
                disabled={submitting || !isOwner}
                className="px-5 py-2.5 rounded-xl font-semibold text-black hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-60 disabled:pointer-events-none"
                style={{ backgroundColor: "#ffd28e" }}
              >
                {submitting ? "Launching..." : "Confirm launch"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
