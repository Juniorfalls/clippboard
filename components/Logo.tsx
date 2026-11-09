import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: "h-7 w-7",
  md: "h-8 w-8",
  lg: "h-10 w-10",
};

export function Logo({
  showText = true,
  size = "md",
  className,
}: {
  showText?: boolean;
  size?: LogoSize;
  className?: string;
}) {
  const sizeClasses = cn("shrink-0", SIZE_CLASSES[size]);

  return (
    <span className={cn("inline-flex items-center gap-2 text-current", className)}>
      <svg viewBox="0 0 32 32" role="img" aria-label="Clippboard logo" className={sizeClasses}>
        {/* Outer rounded square - uses currentColor so it adapts to light/dark mode */}
        <rect width="32" height="32" rx="8" fill="currentColor" />

        {/* Inner white cutout - uses the warm-white background color */}
        <path
          d="M10 11C10 10.4477 10.4477 10 11 10H21C21.5523 10 22 10.4477 22 11V12.5C22 13.0523 21.5523 13.5 21 13.5H18C17.4477 13.5 17 13.9477 17 14.5V17.5C17 18.0523 17.4477 18.5 18 18.5H21C21.5523 18.5 22 18.9477 22 19.5V21C22 21.5523 21.5523 22 21 22H11C10.4477 22 10 21.5523 10 21V11Z"
          fill="#F9F7F4"
        />
      </svg>

      {showText && (
        <svg
          viewBox="0 0 150 32"
          aria-hidden="true"
          className={cn("w-auto", SIZE_CLASSES[size])}
        >
          <text
            x="0"
            y="24"
            fill="currentColor"
            fontSize="26"
            fontWeight="700"
            letterSpacing="-1"
          >
            Clippboard
          </text>
        </svg>
      )}
    </span>
  );
}
