import { cn } from "@/lib/utils";

/** Pulsing placeholder shaped like a 9:16 clip card. Used instead of spinners. */
export function ClipSkeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse overflow-hidden rounded-3 border border-gray-200 bg-white",
        className
      )}
    >
      <div className="aspect-[9/16] bg-gray-200" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}
