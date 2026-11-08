"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    question: "How does browser-based processing work?",
    answer:
      "Your video is rendered locally in your browser using WebCodecs and FFmpeg WASM. The source footage stays on your device; only the extracted audio is sent to our AI service for transcription and moment detection.",
  },
  {
    question: "Why does my video take a long time to process?",
    answer:
      "Rendering happens on your machine, so speed depends on your device, the video length, and the selected resolution. Keep the tab open and avoid switching away during export. Short videos at 1080p finish fastest.",
  },
  {
    question: "How do I upgrade to the Pro plan?",
    answer:
      "Open the pricing section from the landing page or the upgrade link in the dashboard. Pro unlocks unlimited clip generation, 4K exports, filler-word removal, and watermark-free downloads.",
  },
  {
    question: "Can I export to Final Cut Pro?",
    answer:
      "Yes. Agency workspaces can export a clip as FCPXML from the clip options menu. Starter and Pro users can upgrade to Agency to unlock Final Cut Pro export.",
  },
  {
    question: "What happens to my source video and clips?",
    answer:
      "Source videos are processed in your browser. We store account, project, and clip metadata in Supabase so your workspace and usage metrics stay in sync. You can download rendered clips directly from the gallery.",
  },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function HelpAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const baseId = useId();

  return (
    <div className="flex flex-col gap-3">
      {FAQS.map((faq, index) => {
        const isOpen = openIndex === index;
        const triggerId = `${baseId}-trigger-${index}`;
        const panelId = `${baseId}-panel-${index}`;

        return (
          <div
            key={faq.question}
            className="overflow-hidden rounded-2xl border border-border-gray bg-white"
          >
            <button
              type="button"
              id={triggerId}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpenIndex(isOpen ? null : index)}
              className={cn(
                "flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[16px] font-semibold text-soft-black duration-200 hover:bg-warm-white sm:px-6",
                focusRing
              )}
            >
              {faq.question}
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-brand-blue duration-200",
                  isOpen && "rotate-180"
                )}
                aria-hidden
              />
            </button>
            {isOpen && (
              <div
                id={panelId}
                role="region"
                aria-labelledby={triggerId}
                className="border-t border-border-gray px-5 py-4 text-[15px] leading-relaxed text-soft-black/65 sm:px-6"
              >
                {faq.answer}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
