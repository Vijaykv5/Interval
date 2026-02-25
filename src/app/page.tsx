import Image from "next/image";
import Link from "next/link";
import { WalletAuth } from "@/components/wallet-auth";
import { LandingCtas } from "@/components/landing-ctas";
import { LandingOnboardingGate } from "@/components/landing-onboarding-gate";
import { CursorGlow } from "@/components/cursor-glow";

const CREATOR_CARD_TEMPLATES = [
  { src: "/images/6.png", alt: "Creator", accent: "var(--interval-card-rare)", price: "2 SOL", priceLabel: "/ book", description: "Book a 1:1 slot. Quick calls and AMAs." },
  { src: "/images/2.png", alt: "Creator", accent: "var(--interval-card-common)", price: "1.5 SOL", priceLabel: "/ book", description: "Founder office hours and strategy chats." },
  { src: "/images/5.png", alt: "Creator", accent: "var(--interval-card-uncommon)", price: "2.5 SOL", priceLabel: "/ book", description: "Expert sessions and community Q&As." },
  { src: "/images/4.png", alt: "Creator", accent: "var(--interval-card-epic)", price: "3 SOL", priceLabel: "/ book", description: "Deep dives and long-form conversations." },
  { src: "/images/3.png", alt: "Creator", accent: "var(--interval-card-legendary)", price: "2 SOL", priceLabel: "/ book", description: "Book a slot and connect on Solana." },
];

/** Fanned card layout: center straight, adjacent slightly twisted, ends more twisted */
function getCardTransform(i: number, total: number) {
  const centerI = Math.floor(total / 2);
  const distFromCenter = i - centerI;
  const step = 6;
  const rotation = distFromCenter * step;
  const offsetX = distFromCenter * 240;
  const translateY = Math.abs(distFromCenter) * 6;
  const scale = 1 - Math.abs(distFromCenter) * 0.035;
  const zIndex = i === centerI ? 20 : 10 + i;
  return { rotation, offsetX, translateY, scale, zIndex };
}

export default function Home() {
  return (
    <LandingOnboardingGate>
    <div className="min-h-screen h-screen max-h-screen flex flex-col text-white overflow-hidden relative">
      <CursorGlow />
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 shrink-0 w-full">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight"
          style={{ color: "#ffd28e" }}
        >
          INTERVAL
        </Link>
        <div className="min-w-[100px] flex justify-end">
          <WalletAuth variant="landing" unauthenticatedLabel="SIGN IN" />
        </div>
      </header>

      {/* Top: heading, subheading, CTAs — pulled down a bit */}
      <section className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-12 sm:pt-24 pb-8 md:pb-12 sm:pb-16 text-center">
        <div className="max-w-2xl mx-auto">
          <h1
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl uppercase tracking-[0.08em] text-white mb-5 font-extrabold sm:whitespace-nowrap"
            style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
          >
            Book. <span style={{ color: "#ffd28e" }}>Schedule.</span> Win.
          </h1>
          <p
            className="text-base sm:text-lg md:text-xl lg:text-2xl text-white/70 mb-6 sm:mb-8 sm:whitespace-nowrap"
            style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
          >
            Book time with your favorite creators and founders on Solana.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center flex-wrap">
            <LandingCtas />
          </div>
        </div>
      </section>

      {/* Bottom: 5 fanned cards — hidden on mobile, visible from md up; desktop unchanged */}
      <section className="hidden md:flex w-full justify-center items-end px-1 sm:px-2 pb-0 min-h-0 overflow-hidden shrink-0 mt-auto">
        <div className="relative w-full max-w-[100vw] h-[420px] sm:h-[520px] flex justify-center items-end overflow-hidden" style={{ minWidth: "100%" }}>
          {CREATOR_CARD_TEMPLATES.map((card, i) => {
            const total = CREATOR_CARD_TEMPLATES.length;
            const { rotation, offsetX, translateY, scale, zIndex } = getCardTransform(i, total);
            const cardW = 320;
            const cardH = 480;
            return (
              <div
                key={`${card.src}-${i}`}
                className="absolute group cursor-default hover:z-50"
                style={{
                  left: "50%",
                  bottom: 0,
                  marginLeft: offsetX - cardW / 2,
                  width: cardW,
                  height: cardH,
                  transform: `translateY(${translateY}px) rotate(${rotation}deg) scale(${scale})`,
                  transformOrigin: "bottom center",
                  zIndex,
                  transition: "transform 0.25s ease, z-index 0s",
                }}
              >
                <div
                  className="w-full h-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl transition-transform duration-250 ease-out group-hover:scale-110 relative"
                  style={{ transformOrigin: "bottom center" }}
                >
                  <div
                    className="relative w-full h-full"
                    style={{ backgroundColor: card.accent }}
                  >
                    <Image
                      src={card.src}
                      alt={card.alt}
                      fill
                      className="object-cover object-top"
                      sizes="320px"
                    />
                  </div>
                  {/* Hover overlay: slides from image bottom to full top, covers whole card */}
                  <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center px-5 py-6 text-center transform translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out"
                  >
                    <p className="text-lg font-semibold mb-2" style={{ color: "var(--interval-lime)" }}>
                      {card.price}
                      <span className="text-white/90 font-normal">{card.priceLabel}</span>
                    </p>
                    <p className="text-sm text-white/80 line-clamp-3 leading-relaxed max-w-[90%]">
                      {card.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
    </LandingOnboardingGate>
  );
}
