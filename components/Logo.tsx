import { cn } from "@/lib/utils";

type LogoSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<LogoSize, string> = {
  sm: "h-7",
  md: "h-8",
  lg: "h-10",
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
  return (
    <svg
      viewBox={showText ? "0 0 200 40" : "0 0 40 40"}
      role="img"
      aria-label="Clippboard"
      className={cn("w-auto", SIZE_CLASSES[size], className)}
    >
      <defs>
        <mask
          id="clippboard-mark-cutout"
          maskUnits="userSpaceOnUse"
          x="0"
          y="0"
          width="40"
          height="40"
        >
          <rect width="40" height="40" rx="10" fill="white" />
          <path
            d="M28.2 12.2a11.5 11.5 0 1 0 0 15.6"
            fill="none"
            stroke="black"
            strokeWidth="5.5"
            strokeLinecap="round"
          />
        </mask>
      </defs>

      <rect
        width="40"
        height="40"
        rx="10"
        fill="currentColor"
        mask="url(#clippboard-mark-cutout)"
      />

      {showText && (
        <text
          x="52"
          y="28"
          fill="currentColor"
          fontSize="26"
          fontWeight="700"
          letterSpacing="-1"
        >
          Clippboard
        </text>
      )}
    </svg>
  );
}
