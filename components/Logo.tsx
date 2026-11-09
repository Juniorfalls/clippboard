import Image from "next/image";
import { cn } from "@/lib/utils";

/** Clippboard icon used where the full wordmark would be too wide. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/icon.png"
      alt="Clippboard icon"
      width={82}
      height={68}
      className={cn("h-8 w-auto object-contain", className)}
    />
  );
}

/** Full Clippboard wordmark, including the icon. */
export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/logo.png"
      alt="Clippboard"
      width={311}
      height={75}
      className={cn("h-8 w-auto object-contain sm:h-10", className)}
    />
  );
}
