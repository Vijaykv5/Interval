import Image from "next/image";
import { FaqAccordion } from "@/components/faq-accordion";
import { LandingCtas } from "@/components/landing-ctas";
import { LandingOnboardingGate } from "@/components/landing-onboarding-gate";
import { CursorGlow } from "@/components/cursor-glow";
import { SiteNav } from "@/components/site-nav";
import { LANDING_FAQ_ITEMS } from "@/lib/constants";

const CREATOR_CARD_TEMPLATES = [
  { src: "/images/6.png", alt: "Creator", accent: "var(--interval-card-rare)", price: "2 SOL", priceLabel: "/ book", description: "Book a 1:1 slot. Quick calls and AMAs." },
  { src: "/images/2.png", alt: "Creator", accent: "var(--interval-card-common)", price: "1.5 SOL", priceLabel: "/ book", description: "Founder office hours and strategy chats." },
  { src: "/images/5.png", alt: "Creator", accent: "var(--interval-card-uncommon)", price: "2.5 SOL", priceLabel: "/ book", description: "Expert sessions and community Q&As." },
  { src: "/images/4.png", alt: "Creator", accent: "var(--interval-card-epic)", price: "3 SOL", priceLabel: "/ book", description: "Deep dives and long-form conversations." },
  { src: "/images/3.png", alt: "Creator", accent: "var(--interval-card-legendary)", price: "2 SOL", priceLabel: "/ book", description: "Book a slot and connect on Solana." },
];

const LANDING_VIDEO_SRC = "/videos/landing-loop.mp4";
const CREATORS_USERS_VIDEO_SRC = "/videos/creators-users-loop.mp4";

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
    <main className="relative min-h-screen overflow-x-hidden bg-black text-white">
      <CursorGlow />

      <div
        className="relative flex min-h-screen flex-col overflow-hidden"
        style={{
          background:
            "radial-gradient(circle at 9% 54%, rgba(255, 210, 142, 0.52) 0%, rgba(214, 109, 80, 0.34) 20%, rgba(95, 48, 42, 0.18) 38%, transparent 61%), radial-gradient(circle at 83% 78%, rgba(255, 210, 142, 0.5) 0%, rgba(214, 109, 80, 0.38) 22%, rgba(184, 90, 69, 0.24) 42%, transparent 68%), linear-gradient(180deg, #050509 0%, #08080f 20%, #191720 44%, #813f32 76%, #d49a62 100%)",
        }}
      >
        <div className="relative z-20">
          <SiteNav minimal />
        </div>
        <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,0,0,0.62)_0%,rgba(0,0,0,0.34)_42%,transparent_78%)]" aria-hidden />
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(1px_1px_at_12%_18%,rgba(255,255,255,0.32),transparent),radial-gradient(1px_1px_at_72%_22%,rgba(255,255,255,0.24),transparent),radial-gradient(1px_1px_at_44%_64%,rgba(255,255,255,0.2),transparent),radial-gradient(1px_1px_at_88%_78%,rgba(255,255,255,0.28),transparent)] bg-[length:420px_420px] opacity-55" aria-hidden />
        {/* Top: heading, subheading, CTAs — pulled down a bit */}
        <section className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 sm:px-6 pt-12 sm:pt-24 pb-8 md:pb-12 sm:pb-16 text-center">
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
        <section className="relative z-10 hidden md:flex w-full justify-center items-end px-1 sm:px-2 pb-0 min-h-0 overflow-hidden shrink-0 mt-auto">
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
                    className="w-full h-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out group-hover:scale-110 relative"
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
                      className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center px-5 py-6 text-center transform translate-y-full group-hover:translate-y-0 motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out"
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

        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-44 bg-gradient-to-b from-transparent via-black/50 to-black" />
      </div>

      <section className="relative min-h-screen bg-black px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black to-transparent" />
        <div className="pointer-events-none absolute left-1/2 top-24 h-[28rem] w-[28rem] -translate-x-1/2 rounded-full bg-[#ffd28e]/10 blur-3xl" />
        <div className="mx-auto max-w-7xl">
          <h2
            className="relative text-center text-4xl font-extrabold tracking-normal text-white sm:text-5xl lg:text-6xl"
            style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
          >
            Call it. Lock it. Own it.
          </h2>

          <div className="relative mt-14 grid items-center gap-10 lg:mt-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
            <div className="mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
              <p className="text-xl font-semibold" style={{ color: "#ffd28e" }}>
                Watch
              </p>
              <h3
                className="mt-5 text-3xl font-extrabold leading-tight text-white sm:text-4xl lg:text-5xl"
                style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
              >
                Watch your booked call come together in real time
              </h3>
              <p className="mt-5 text-base leading-7 text-white/65 sm:text-lg">
                Give visitors a quick product preview as they scroll. Drop your loop into
                <span className="text-white"> public/videos/landing-loop.mp4</span> and this frame will play it automatically.
              </p>
            </div>

            <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-[#ffd28e]/15 bg-white/[0.035] shadow-2xl shadow-black/40">
              <div className="aspect-[16/9] bg-[#070707]">
                <video
                  className="h-full w-full object-cover"
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  poster="/images/flow-diagram.png"
                  aria-label="Interval product preview"
                >
                  <source src={LANDING_VIDEO_SRC} type="video/mp4" />
                </video>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative min-h-screen bg-black px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black via-black/80 to-transparent" />
        <div className="pointer-events-none absolute right-0 top-12 h-[24rem] w-[24rem] rounded-full bg-[#ffd28e]/[0.07] blur-3xl" />
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
          <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-[#ffd28e]/15 bg-white/[0.035] shadow-2xl shadow-black/40">
            <div className="aspect-[16/9] bg-[#070707]">
              <video
                className="h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                poster="/images/flow-diagram.png"
                aria-label="Interval creators and users preview"
              >
                <source src={CREATORS_USERS_VIDEO_SRC} type="video/mp4" />
                <source src={LANDING_VIDEO_SRC} type="video/mp4" />
              </video>
            </div>
          </div>

          <div className="relative mx-auto max-w-xl text-center lg:mx-0 lg:text-left">
            <p className="text-xl font-semibold" style={{ color: "#ffd28e" }}>
              For creators and users
            </p>
            <h2
              className="mt-5 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
            >
              One place to sell time and book access
            </h2>
            <p className="mt-5 text-base leading-7 text-white/65 sm:text-lg">
              Creators get a simple way to open paid slots. Users get a clean booking flow,
              clear payment confirmation, and direct access to the people they follow.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
                <p className="text-sm font-semibold text-white">Creators</p>
                <p className="mt-2 text-sm leading-6 text-white/60">Set your price, share your page, and manage bookings.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-left">
                <p className="text-sm font-semibold text-white">Users</p>
                <p className="mt-2 text-sm leading-6 text-white/60">Find a slot, pay on Solana, and show up with context.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative bg-black px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black via-black/80 to-transparent" />
        <div className="mx-auto max-w-5xl">
          <div className="text-center">
            <h2
              className="text-4xl font-extrabold tracking-normal text-white sm:text-5xl lg:text-6xl"
              style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
            >
              Good to know
            </h2>
            <p className="mt-4 text-base text-white/55 sm:text-lg">
              A few quick answers before you book or open your slots.
            </p>
          </div>

          <FaqAccordion items={LANDING_FAQ_ITEMS} />
        </div>
      </section>

      <footer className="relative min-h-[220px] overflow-hidden bg-black px-4 pb-10 pt-24 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black to-transparent" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#ffd28e]/10 to-transparent" />
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 whitespace-nowrap text-center text-[22vw] font-extrabold leading-none text-white/[0.08]"
          style={{ fontFamily: "var(--font-archivo-condensed), sans-serif" }}
        >
          INTERVAL
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col gap-8 text-sm text-white/60 md:flex-row md:items-center md:justify-between">
          <p>© 2026 INTERVAL</p>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3">
            <a className="motion-safe:transition-colors motion-safe:duration-150 hover:text-white" href="/">
              Home
            </a>
            <a className="motion-safe:transition-colors motion-safe:duration-150 hover:text-white" href="/explore">
              Explore
            </a>
            <a className="motion-safe:transition-colors motion-safe:duration-150 hover:text-white" href="/dashboard">
              Dashboard
            </a>
            <a className="motion-safe:transition-colors motion-safe:duration-150 hover:text-white" href="/profile">
              Profile
            </a>
          </nav>
        </div>
      </footer>
    </main>
    </LandingOnboardingGate>
  );
}
