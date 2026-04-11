import type { Metadata } from "next";
import { Geist, Geist_Mono, Press_Start_2P, Bebas_Neue } from "next/font/google";
import localFont from "next/font/local";
import { Toaster } from "sonner";
import { PrivyProviders } from "@/components/privy-providers";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${pressStart2P.variable} ${bebasNeue.variable} ${archivoCondensed.variable} ${utendo.variable} antialiased min-h-screen bg-[#030305]`}
      >
        {/* Ready to Entangle – stacked background layers */}
        <div className="bg-orbit-base" aria-hidden />
        <div className="bg-starfield" aria-hidden />
        <div className="bg-orbit-glow" aria-hidden />
        <div className="relative z-10 min-h-screen bg-transparent">
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
        </div>
      </body>
    </html>
  );
}
