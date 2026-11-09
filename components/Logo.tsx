import { cn } from "@/lib/utils";

/** Clippboard mark: a clipboard whose page is a play-shaped clip. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="Clippboard logo"
      className={cn("h-8 w-8", className)}
    >
      <rect width="32" height="32" rx="8" fill="#1C1C1C" />
      <rect x="9" y="8" width="14" height="17" rx="3" fill="#F9F7F4" />
      <rect x="12.5" y="5.5" width="7" height="5" rx="2" fill="#3B82F6" />
      <path d="M14 14.5v6l5-3z" fill="#1C1C1C" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-2xl font-bold -tracking-1 text-soft-black">Clippboard</span>
    </span>
  );
}
