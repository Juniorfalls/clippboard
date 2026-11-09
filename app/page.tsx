import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Captions,
  Download,
  Palette,
  Play,
  Send,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Logo, LogoMark } from "@/components/Logo";
import { cn } from "@/lib/utils";
import { SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: "Clippboard | AI Video Clipping" },
  description:
    "Clippboard turns long-form videos into engaging vertical clips with AI moment detection, transcription, captions, and secure browser-based rendering.",
  openGraph: {
    title: "Clippboard | AI Video Clipping",
    description:
      "Turn long-form videos into engaging vertical clips with AI moment detection, transcription, captions, and secure browser-based rendering.",
    url: `${SITE_URL}/`,
    siteName: "Clippboard",
    type: "website",
    images: [
      {
        // Replace /public/og-image.png with the final social preview image.
        url: `${SITE_URL}/og-image.png`,
        width: 1200,
        height: 630,
        alt: "Clippboard AI video clipping workspace",
      },
    ],
  },
  alternates: { canonical: `${SITE_URL}/` },
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 focus-visible:ring-offset-warm-white";

const primaryButton = cn(
  "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-6 py-3.5 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
  focusRing
);

const BENTO_FEATURES: {
  title: string;
  description: string;
  icon: LucideIcon;
  items: string[];
  large?: boolean;
}[] = [
  {
    title: "AI Analysis & Editing",
    description: "Let AI find the perfect moments and reframe them automatically.",
    icon: Sparkles,
    items: [
      "AI Highlight Detection",
      "9:16 Auto-Reframing",
      "Filler Word Removal",
      "Smart Clip Trimming",
    ],
    large: true,
  },
  {
    title: "Brand Customization",
    description: "Your brand, every time.",
    icon: Palette,
    items: [
      "Custom Fonts & Colors",
      "Animated Intros/Outros",
      "Brand Templates",
    ],
  },
  {
    title: "Social Media Scheduling",
    description: "Publish directly to your audience.",
    icon: Send,
    items: [
      "Connect TikTok & YouTube",
      "Schedule Posts",
      "Direct Publishing",
    ],
  },
  {
    title: "Professional Exports",
    description: "Take your content to the next level.",
    icon: Download,
    items: [
      "4K Upscaling",
      "Final Cut Pro XML Export",
      "Batch Export Presets",
      "MCP Server Access (for AI agents)",
    ],
    large: true,
  },
];

function CheckMark() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="h-4 w-4 shrink-0 text-brand-blue"
      fill="none"
    >
      <circle cx="10" cy="10" r="9" stroke="currentColor" opacity="0.28" />
      <path
        d="m6 10.2 2.5 2.5L14.2 7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeroMockup() {
  return (
    <div className="relative mx-auto w-full max-w-[640px] overflow-hidden rounded-3 border-4 border-blue-200 bg-warm-white shadow-[0_28px_80px_rgba(28,28,28,0.12)]">
      <div className="flex items-center gap-3 border-b border-border-gray bg-white/80 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" aria-hidden="true" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" aria-hidden="true" />
        <span className="mx-auto rounded-full bg-warm-white px-3 py-1 text-[11px] font-semibold text-soft-black/50">
          app.clippboard.com
        </span>
      </div>

      <div className="grid gap-4 bg-white/50 p-3 sm:p-5 md:grid-cols-[150px_1fr] md:p-6">
        <aside className="hidden rounded-2 border border-border-gray bg-white p-3 md:block">
          <div className="flex items-center gap-2 rounded-lg bg-warm-white px-2.5 py-2">
            <LogoMark className="h-6 w-6" />
            <span className="text-[13px] font-bold">Clippboard</span>
          </div>
          <div className="mt-4 space-y-1.5">
            {["Workspace", "Projects", "Team", "Settings"].map(
              (item, index) => (
                <div
                  key={item}
                  className={cn(
                    "rounded-lg px-2.5 py-2 text-[11px] font-semibold",
                    index === 0
                      ? "bg-brand-blue-light/70 text-soft-black"
                      : "text-soft-black/45"
                  )}
                >
                  {item}
                </div>
              )
            )}
          </div>
          <div className="mt-6 rounded-xl border border-border-gray bg-warm-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-soft-black/40">
              Workspace
            </p>
            <p className="mt-1 text-[11px] font-bold">Studio Team</p>
          </div>
        </aside>

        <div className="min-w-0 rounded-2 border border-border-gray bg-white p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-blue">
                New project
              </p>
              <p className="text-[16px] font-bold leading-tight sm:text-[20px]">
                Podcast highlights
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border-gray bg-warm-white px-2.5 py-1 text-[9px] font-semibold text-soft-black/60">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
              Processing in browser
            </span>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              {
                src: "https://assets.codepen.io/6093409/river.mp4",
                poster:
                  "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?q=80&w=600&auto=format&fit=crop",
                title: "Changed everything",
              },
              {
                src: "https://www.w3schools.com/html/mov_bbb.mp4",
                poster:
                  "https://images.unsplash.com/photo-1621360841012-786b0690274b?q=80&w=600&auto=format&fit=crop",
                title: "Content system",
              },
              {
                src: "https://assets.codepen.io/6093409/river.mp4",
                poster:
                  "https://images.unsplash.com/photo-1589903308904-1010c2294adc?q=80&w=600&auto=format&fit=crop",
                title: "Great storytelling",
              },
            ].map((clip, index) => (
              <div
                key={clip.src}
                className="overflow-hidden rounded-xl border border-border-gray bg-warm-white"
              >
                <div className="relative aspect-[9/13] overflow-hidden">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    poster={clip.poster}
                    aria-hidden="true"
                    className="absolute inset-0 w-full h-full object-cover z-0"
                  >
                    <source src={clip.src} type="video/mp4" />
                  </video>
                  <span className="pointer-events-none absolute inset-0 z-[1] bg-gradient-to-t from-soft-black/30 via-transparent to-soft-black/10" aria-hidden="true" />
                  <span className="pointer-events-none absolute left-1.5 top-1.5 z-10 rounded-full bg-white/90 px-1.5 py-0.5 text-[7px] font-bold text-soft-black">
                    {92 - index * 11}
                  </span>
                  <span className="pointer-events-none absolute bottom-1.5 left-1.5 right-1.5 z-10 truncate whitespace-nowrap rounded-md bg-white/90 px-1.5 py-1 text-[8px] font-bold leading-tight text-soft-black">
                    {clip.title}
                  </span>
                </div>
                <div className="flex items-center justify-between px-2 py-1.5 text-[7px] font-semibold text-soft-black/50">
                  <span>0:{24 + index * 9}</span>
                  <span className="text-brand-blue">Ready</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_120px]">
            <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-border-gray bg-warm-white p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-blue text-soft-black">
                  <Captions className="h-3 w-3" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[9px] font-bold">Captions are on brand</p>
                  <p className="truncate text-[8px] text-soft-black/45">
                    Inter · #3B82F6 · bold karaoke style
                  </p>
                </div>
              </div>
              <div className="mt-2 flex min-w-0 flex-wrap gap-1">
                {[70, 45, 85, 60, 35, 75, 50].map((width, index) => (
                  <span
                    key={index}
                    className="h-1 rounded-full bg-brand-blue/30"
                    style={{ width: `${width / 2}px` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 rounded-xl bg-soft-black p-2.5 text-white">
              <Play className="h-3.5 w-3.5 text-brand-blue" aria-hidden="true" />
              <span className="text-[9px] font-semibold">Preview clips</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const PRICING_TIERS = [
  {
    name: "Starter",
    price: "$0",
    cadence: "/ month",
    description: "For creators testing the workflow.",
    features: ["3 videos/month", "1080p Export", "Watermark applied"],
    cta: "Start for Free",
    href: "/login",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    cadence: "/ month",
    description: "For creators shipping content every week.",
    features: [
      "Unlimited videos",
      "4K Export",
      "Filler word removal",
      "No watermark",
      "Karaoke captions",
    ],
    cta: "Start 7-Day Free Trial",
    href: "/login",
    highlighted: true,
  },
  {
    name: "Agency",
    price: "$49",
    cadence: "/ month",
    description: "For teams producing at scale.",
    features: [
      "Everything in Pro",
      "Final Cut Pro XML Export",
      "Custom Brand Templates",
      "MCP Server Access",
    ],
    cta: "Contact Sales",
    href: "/login",
    highlighted: false,
  },
];

function SocialIcon({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-white/70 duration-200 hover:border-brand-blue hover:text-brand-blue",
        "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-5 w-5"
        aria-hidden="true"
      >
        {children}
      </svg>
    </a>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-warm-white text-soft-black">
      <header className="sticky top-0 z-40 border-b border-border-gray/70 bg-warm-white/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1280px] items-center justify-between px-4 py-4">
          <Link
            href="/"
            aria-label="Clippboard home"
            className={cn("rounded-lg", focusRing)}
          >
            <Logo />
          </Link>
          <div className="flex items-center gap-8">
            <nav
              aria-label="Landing page sections"
              className="hidden items-center gap-6 md:flex"
            >
              <Link
                href="#features"
                className={cn(
                  "text-[14px] font-semibold text-soft-black transition-colors duration-200 hover:text-brand-blue",
                  focusRing
                )}
              >
                Features
              </Link>
              <Link
                href="#pricing"
                className={cn(
                  "text-[14px] font-semibold text-soft-black transition-colors duration-200 hover:text-brand-blue",
                  focusRing
                )}
              >
                Pricing
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Link
                href="/login"
                className={cn(
                  "hidden rounded-lg px-3 py-2 text-[14px] font-semibold text-soft-black/70 duration-200 hover:bg-white hover:text-soft-black sm:inline-flex",
                  focusRing
                )}
              >
                Sign In
              </Link>
              <Link
                href="/login"
                className={cn(
                  "inline-flex items-center justify-center rounded-2 bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
                  focusRing
                )}
              >
                Start Clipping
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main>
        <section className="px-4 pb-20 pt-10 sm:px-6 sm:pt-14 md:pb-24 md:pt-20">
          <div className="mx-auto grid w-full max-w-[1280px] grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div className="flex flex-col items-start">
              <p className="text-[16px] font-bold text-soft-black sm:text-[18px]">
                The AI video workspace for creators.
              </p>
              <h1 className="mt-4 max-w-2xl text-[46px] font-bold leading-[1] -tracking-1 text-soft-black sm:text-[64px]">
                Turn long videos into engaging short-form content.
              </h1>
              <p className="mt-5 max-w-xl text-[18px] leading-relaxed text-gray-500 sm:mt-6">
                Clippboard uses AI to find the best moments, reframe them to
                9:16, and add animated captions—all processed securely in your
                browser.
              </p>
              <Link
                href="/login"
                className={cn(primaryButton, "mt-6 px-7 py-4 text-[18px] sm:mt-8")}
              >
                Start Clipping Free
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>

            <div className="relative">
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -inset-8 rounded-full bg-gradient-to-br from-brand-blue/30 via-blue-200/40 to-transparent blur-3xl sm:-inset-12"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-brand-blue/25 blur-2xl"
              />
              <div className="relative">
                <HeroMockup />
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="scroll-mt-24 bg-soft-black px-4 py-24 text-warm-white sm:px-6"
        >
          <div className="mx-auto w-full max-w-shell">
            <h2 className="mx-auto max-w-4xl text-center text-[36px] font-bold leading-[1.03] -tracking-1 sm:text-[48px] lg:text-[64px]">
              One workspace for every step between{" "}
              <span className="text-blue-500">raw footage and finished clips.</span>
            </h2>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {BENTO_FEATURES.map(
                ({ title, description, icon: Icon, items, large }, index) => (
                  <article
                    key={title}
                    className={cn(
                      "flex flex-col rounded-3 border border-white/10 bg-white/5 p-8",
                      large && "md:col-span-2 lg:col-span-2"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-blue text-soft-black">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span className="text-[12px] font-semibold uppercase tracking-widest text-warm-white/30">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-8 min-h-[66px] text-[26px] font-bold leading-[1.25]">
                      {title}
                    </h3>
                    <p className="mt-2 max-w-xl text-[16px] text-warm-white/70">
                      {description}
                    </p>
                    <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                      {items.map((item) => (
                        <li
                          key={item}
                          className="flex items-center gap-2 text-[14px] text-warm-white/85"
                        >
                          <CheckMark />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </article>
                )
              )}
            </div>
          </div>
        </section>

        <section className="bg-soft-black px-4 pb-20 pt-8 text-white sm:px-6">
          <div className="mx-auto w-full max-w-4xl">
            <div className="rounded-3 border border-white/10 bg-white/5 px-6 py-12 text-center sm:px-12 sm:py-16">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue/40 bg-brand-blue/10 px-4 py-1.5 text-[13px] font-semibold text-brand-blue">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Early Access
              </span>
              <h2 className="mx-auto mt-6 max-w-3xl text-[30px] font-bold leading-[1.08] -tracking-1 sm:text-[40px]">
                Be first in line for a faster way to create clips.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-[16px] leading-relaxed text-white/70 sm:text-[18px]">
                Clippboard is opening to a small group of creators. Join the
                early access list to try new features first and help shape what
                comes next.
              </p>
              <Link
                href="/login"
                className={cn(primaryButton, "mt-7 px-6 py-3.5")}
              >
                Request Early Access
                <ArrowRight className="h-5 w-5" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section
          id="pricing"
          aria-labelledby="pricing-heading"
          className="scroll-mt-24 bg-warm-white px-4 py-20 sm:px-6"
        >
          <div className="mx-auto max-w-5xl">
            <div className="text-center">
              <h2
                id="pricing-heading"
                className="text-[36px] font-bold leading-[1.05] -tracking-1 text-soft-black sm:text-[40px]"
              >
                Simple pricing for serious creators.
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-[16px] text-gray-500 sm:text-[18px]">
                Start free, then choose the plan that matches your output.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
              {PRICING_TIERS.map((tier) => {
                const card = (
                  <article
                    className={cn(
                      "relative flex h-full flex-col rounded-3 border bg-white p-8",
                      tier.highlighted
                        ? "border-2 border-brand-blue shadow-lg"
                        : "border-gray-200"
                    )}
                  >
                    {tier.highlighted && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-blue px-3 py-1 text-[12px] font-bold text-soft-black">
                        Most Popular
                      </span>
                    )}
                    <h3 className="text-[24px] font-bold leading-[1.25] text-soft-black">
                      {tier.name}
                    </h3>
                    <p className="mt-2 min-h-[48px] text-[14px] text-soft-black/60">
                      {tier.description}
                    </p>
                    <div className="mt-6 flex items-end gap-1">
                      <span className="text-[40px] font-bold leading-none -tracking-1 text-soft-black">
                        {tier.price}
                      </span>
                      <span className="pb-1 text-[14px] font-semibold text-soft-black/50">
                        {tier.cadence}
                      </span>
                    </div>
                    <hr className="my-6 border-gray-200" />
                    <ul className="flex flex-1 flex-col gap-3">
                      {tier.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-center gap-2 text-[14px] text-soft-black/75"
                        >
                          <CheckMark />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href={tier.href}
                      className={cn(
                        "mt-8 inline-flex items-center justify-center rounded-2 px-5 py-3 text-[14px] font-semibold duration-200",
                        tier.highlighted
                          ? "bg-brand-blue text-soft-black hover:bg-brand-blue-hover"
                          : "border border-border-gray bg-white text-soft-black hover:bg-warm-white",
                        focusRing
                      )}
                    >
                      {tier.cta}
                    </Link>
                  </article>
                );

                return <div key={tier.name}>{card}</div>;
              })}
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 pt-16 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <h2 className="text-[36px] font-bold leading-[1] -tracking-1 sm:text-[40px]">
              Ready to scale your content?
            </h2>
            <Link href="/login" className={cn(primaryButton, "mt-7 px-7 py-4 text-[18px]")}>
              Start Clipping Free
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="bg-soft-black px-4 py-20 text-white sm:px-6">
        <div className="mx-auto grid w-full max-w-shell grid-cols-12 gap-8">
          <div className="col-span-12 md:col-span-4">
            <Link
              href="/"
              aria-label="Clippboard home"
              className={cn("inline-flex items-center gap-2 rounded-lg", focusRing)}
            >
              <span className="rounded-lg ring-1 ring-white/15">
                <LogoMark />
              </span>
              <span className="text-2xl font-bold -tracking-1">Clippboard</span>
            </Link>
            <p className="mt-5 text-[14px] text-white/70">
              © 2026 Clippboard. All rights reserved.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[14px]">
              <a
                href="/privacy"
                className={cn("text-white/70 duration-200 hover:text-brand-blue", focusRing)}
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                className={cn("text-white/70 duration-200 hover:text-brand-blue", focusRing)}
              >
                Terms of Service
              </a>
            </div>
          </div>

          <div className="col-span-12 flex items-start gap-3 md:col-span-4 md:col-start-9 md:justify-end">
            <SocialIcon href="https://www.youtube.com" label="YouTube">
              <rect x="3" y="6" width="18" height="12" rx="4" />
              <path d="m10 9 5 3-5 3z" fill="currentColor" stroke="none" />
            </SocialIcon>
            <SocialIcon href="https://x.com" label="X">
              <path d="M5 4 19 20" />
              <path d="M19 4 5 20" />
            </SocialIcon>
            <SocialIcon href="https://www.instagram.com" label="Instagram">
              <rect x="4" y="4" width="16" height="16" rx="5" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="17.5" cy="6.5" r="0.8" fill="currentColor" stroke="none" />
            </SocialIcon>
            <SocialIcon href="https://www.linkedin.com" label="LinkedIn">
              <path d="M6 9v9" />
              <path d="M6 5.5v.1" />
              <path d="M11 18v-5a3 3 0 0 1 6 0v5" />
              <path d="M11 9v9" />
            </SocialIcon>
          </div>
        </div>
      </footer>
    </div>
  );
}
