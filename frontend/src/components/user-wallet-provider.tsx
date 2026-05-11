"use client";

import bs58 from "bs58";
import { Transaction } from "@solana/web3.js";
import {
  ConnectionProvider,
  WalletProvider,
  useConnection,
  useWallet,
} from "@solana/wallet-adapter-react";
import {
  WalletModalProvider,
  useWalletModal,
} from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useSolanaNetwork } from "@/components/network-provider";
import { getSolanaRpcUrl } from "@/lib/solana-config";
import type {
  IntervalSignAndSendTransaction,
  IntervalSolanaWallet,
} from "@/lib/solana-wallet";

type UserWalletContextValue = {
  ready: boolean;
  connected: boolean;
  connecting: boolean;
  wallet: IntervalSolanaWallet | null;
  walletAddress: string | null;
  walletLabel: string | null;
  openConnectModal: () => void;
  disconnect: () => Promise<void>;
  signAndSendTransaction: IntervalSignAndSendTransaction<IntervalSolanaWallet>;
};

const UserWalletContext = createContext<UserWalletContextValue | null>(null);

function WalletContextBridge({ children }: { children: ReactNode }) {
  const { connection } = useConnection();
  const { publicKey, connected, connecting, disconnect, sendTransaction, wallet } =
    useWallet();
  const { setVisible } = useWalletModal();

  const walletAddress = publicKey?.toBase58() ?? null;

  const openConnectModal = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const signAndSendTransaction = useCallback<
    IntervalSignAndSendTransaction<IntervalSolanaWallet>
  >(
    async ({ transaction }) => {
      if (!publicKey || !connected) {
        throw new Error("Connect your wallet before continuing.");
      }

      const parsedTransaction = Transaction.from(Buffer.from(transaction));
      const signature = await sendTransaction(parsedTransaction, connection, {
        preflightCommitment: "confirmed",
      });

      return { signature: bs58.decode(signature) };
    },
    [connected, connection, publicKey, sendTransaction]
  );

  const value = useMemo<UserWalletContextValue>(
    () => ({
      ready: true,
      connected,
      connecting,
      wallet: walletAddress ? { address: walletAddress } : null,
      walletAddress,
      walletLabel: wallet?.adapter.name ?? null,
      openConnectModal,
      disconnect,
      signAndSendTransaction,
    }),
    [
      connected,
      connecting,
      disconnect,
      openConnectModal,
      signAndSendTransaction,
      wallet?.adapter.name,
      walletAddress,
    ]
  );

  return (
    <UserWalletContext.Provider value={value}>
      {children}
    </UserWalletContext.Provider>
  );
}

export function UserWalletProvider({ children }: { children: ReactNode }) {
  const { network } = useSolanaNetwork();

  const endpoint = useMemo(() => getSolanaRpcUrl(network), [network]);
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <WalletContextBridge>{children}</WalletContextBridge>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function useUserWallet() {
  const context = useContext(UserWalletContext);
  if (!context) {
    throw new Error("useUserWallet must be used within UserWalletProvider.");
  }

  return context;
}
