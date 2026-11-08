import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { HelpAccordion } from "@/components/HelpAccordion";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Help Center" };

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export default function HelpPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-blue-light bg-brand-blue-light/50 px-3 py-1.5 text-[12px] font-semibold text-soft-black/70">
          <LifeBuoy className="h-4 w-4 text-brand-blue" aria-hidden />
          Help center
        </span>
        <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
          How can we help?
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Answers to common questions about browser rendering, plans, exports,
          and your workspace.
        </p>
      </header>

      <HelpAccordion />

      <section className="rounded-3 border border-border-gray bg-white p-6 sm:p-8">
        <h2 className="text-[24px] font-bold leading-[1.25]">
          Still need a hand?
        </h2>
        <p className="mt-2 text-[16px] text-soft-black/60">
          Send us a message and our team will get back to you within 24 hours.
        </p>
        <Link
          href="/support"
          className={cn(
            "mt-5 inline-flex items-center justify-center rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
            focusRing
          )}
        >
          Contact Support
        </Link>
      </section>
    </div>
  );
}
