import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-warm-white text-soft-black">
      <header className="border-b border-border-gray bg-warm-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between">
          <Link href="/" aria-label="Clippboard home" className={cn("rounded-lg", focusRing)}>
            <Logo />
          </Link>
          <Link
            href="/"
            className={cn(
              "inline-flex items-center gap-2 rounded-2 border border-border-gray bg-white px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-light",
              focusRing
            )}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to Home
          </Link>
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-brand-blue">
          Legal
        </p>
        <h1 className="mt-3 text-[40px] font-bold leading-[1] -tracking-1 sm:text-[48px]">
          {title}
        </h1>
        <p className="mt-4 text-[14px] text-soft-black/50">Last updated: {updated}</p>
        <div className="mt-10 flex flex-col gap-6 text-[16px] leading-relaxed text-soft-black/70">
          {children}
        </div>
        <Link
          href="/"
          className={cn(
            "mt-10 inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
            focusRing
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Home
        </Link>
      </article>
    </main>
  );
}
