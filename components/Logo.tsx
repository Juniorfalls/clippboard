import Image from "next/image";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  inverted?: boolean;
}

export function Logo({ className = "", iconOnly = false, inverted = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Image
        src="/logo.svg"
        alt="Clippboard logo"
        width={32}
        height={32}
        className={`h-8 w-auto shrink-0${inverted ? " invert" : ""}`}
      />

      {!iconOnly && (
        <span className="text-2xl font-bold -tracking-1">
          Clippboard
        </span>
      )}
    </div>
  );
}
