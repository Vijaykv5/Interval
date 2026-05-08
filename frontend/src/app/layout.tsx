import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono, Press_Start_2P, Bebas_Neue } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { BetaBanner } from "@/components/beta-banner";
import { NetworkProvider } from "@/components/network-provider";
import { PrivyProviders } from "@/components/privy-providers";
import { getSelectedSolanaNetwork } from "@/lib/solana-config";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  variable: "--font-bebas-neue",
  weight: "400",
  subsets: ["latin"],
});

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
        className={`${geistSans.variable} ${geistMono.variable} ${pressStart2P.variable} ${bebasNeue.variable} ${archivoCondensed.variable} ${utendo.variable} antialiased min-h-screen bg-[#030305]`}
      >
        {/* Ready to Entangle – stacked background layers */}
        <div className="bg-orbit-base" />
        <div className="bg-starfield" />
        <div className="bg-orbit-glow" />
        <div className="relative z-10 min-h-screen bg-transparent">
          <NetworkProvider initialNetwork={initialNetwork}>
            <BetaBanner />
            <PrivyProviders>{children}</PrivyProviders>
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
          </NetworkProvider>
        </div>
      </body>
    </html>
  );
}
