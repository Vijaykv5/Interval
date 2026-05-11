import type { Metadata } from "next";
import { cookies } from "next/headers";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { BetaBanner } from "@/components/beta-banner";
import { CreatorIntentGate } from "@/components/creator-intent-gate";
import { NetworkProvider } from "@/components/network-provider";
import { PrivyProviders } from "@/components/privy-providers";
import { UserWalletProvider } from "@/components/user-wallet-provider";
import { getSelectedSolanaNetwork } from "@/lib/solana-config";
import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";

const archivoCondensed = localFont({
  src: "../../public/fonts/Archivo_Condensed-SemiBold.ttf",
  variable: "--font-archivo-condensed",
  display: "swap",
});

const utendo = localFont({
  src: "../../public/fonts/Utendo-Semibold.ttf",
  variable: "--font-utendo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Interval — Book time with creators on Solana",
  description: "Book time with creators and founders on Solana. Create slots or find a creator and schedule a meeting.",
  icons: {
    icon: "/favicon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map(({ name, value }) => `${name}=${value}`)
    .join("; ");
  const initialNetwork = getSelectedSolanaNetwork(cookieHeader);

  return (
    <html lang="en">
      <body
        className={`${archivoCondensed.variable} ${utendo.variable} antialiased min-h-screen bg-[#030305]`}
        style={
          {
            "--font-geist-sans": "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
            "--font-geist-mono":
              "'SFMono-Regular', 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', monospace",
            "--font-press-start": "'Courier New', monospace",
            "--font-bebas-neue": "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif",
          } as React.CSSProperties
        }
      >
        {/* Ready to Entangle – stacked background layers */}
        <div className="bg-orbit-base" />
        <div className="bg-starfield" />
        <div className="bg-orbit-glow" />
        <div className="relative z-10 min-h-screen bg-transparent">
          <NetworkProvider initialNetwork={initialNetwork}>
            <UserWalletProvider>
              <BetaBanner />
              <PrivyProviders>
                <CreatorIntentGate>{children}</CreatorIntentGate>
              </PrivyProviders>
              <Toaster
                position="bottom-right"
                theme="dark"
                className="interval-toaster"
                toastOptions={{
                  classNames: {
                    toast: "interval-toast",
                    title: "interval-toast-title",
                    description: "interval-toast-description",
                    success: "interval-toast-success",
                    error: "interval-toast-error",
                  },
                }}
              />
            </UserWalletProvider>
          </NetworkProvider>
        </div>
      </body>
    </html>
  );
}
