import Link from "next/link";
import { ArrowLeft, Clapperboard } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-warm-white text-soft-black">
      <header className="px-4 py-5 sm:px-6">
        <Link href="/" aria-label="Clippboard home" className={cn("inline-flex rounded-lg", focusRing)}>
<Logo variant="dark" />
        </Link>
      </header>

      <section className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <span className="flex h-16 w-16 items-center justify-center rounded-3 bg-brand-blue-light text-brand-blue">
          <Clapperboard className="h-8 w-8" aria-hidden />
        </span>
        <p className="mt-6 text-[13px] font-bold uppercase tracking-wide text-brand-blue">
          404 · Page not found
        </p>
        <h1 className="mt-3 max-w-xl text-[42px] font-bold leading-[1] -tracking-1 sm:text-[56px]">
          This cut is missing.
        </h1>
        <p className="mt-4 max-w-md text-[16px] leading-relaxed text-soft-black/60 sm:text-[18px]">
          The page you are looking for may have moved or no longer exists.
        </p>
        <Link
          href="/"
          className={cn(
            "mt-8 inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-6 py-3.5 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
            focusRing
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Home
        </Link>
      </section>
    </main>
  );
}
