"use client";

import { useState } from "react";

type FaqItem = {
  question: string;
  answer: string;
};

type FaqAccordionProps = {
  items: FaqItem[];
};

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="mt-16 border-t border-white/10">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        const answerId = `landing-faq-answer-${index}`;

        return (
          <div key={item.question} className="border-b border-white/10 py-7">
            <button
              type="button"
              className="flex w-full min-h-10 items-center justify-between gap-6 text-left text-lg font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd28e]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
              aria-expanded={isOpen}
              aria-controls={answerId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
            >
              <span>{item.question}</span>
              <span
                className={[
                  "shrink-0 text-2xl font-light text-white/80 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out",
                  isOpen ? "rotate-45" : "rotate-0",
                ].join(" ")}
                aria-hidden
              >
                +
              </span>
            </button>

            <div
              id={answerId}
              className={[
                "grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-200 motion-safe:ease-out",
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
              ].join(" ")}
            >
              <div className="overflow-hidden">
                <p className="mt-4 max-w-3xl text-sm leading-6 text-white/60 sm:text-base">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
