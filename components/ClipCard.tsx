"use client";

import { Download, Play } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Clip } from "@/lib/types";

// Placeholder thumbnails until real frames exist. Brand-blue family only.
const THUMB_GRADIENTS = [
  "from-blue-200 to-blue-500",
  "from-brand-blue-light to-blue-400",
  "from-blue-300 to-blue-600",
  "from-sky-200 to-blue-500",
  "from-indigo-200 to-blue-500",
];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

async function downloadClip(clip: Clip) {
  try {
    const res = await fetch(clip.url);
    if (!res.ok) throw new Error("missing");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${clip.title}.mp4`;
    a.click();
    URL.revokeObjectURL(href);
    toast.success("Download started", { description: clip.title });
  } catch {
    // Mock clips have no real file yet.
    toast("Demo clip", {
      description: "Downloads work once real video processing is connected.",
    });
  }
}

export function ClipCard({ clip, index }: { clip: Clip; index: number }) {
  return (
    <article className="overflow-hidden rounded-3 border-4 border-brand-blue-light bg-white">
      <div
        className={cn(
          "relative aspect-[9/16] bg-gradient-to-br",
          THUMB_GRADIENTS[index % THUMB_GRADIENTS.length]
        )}
      >
        <span
          role="img"
          aria-label="Clip preview"
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-soft-black">
            <Play className="ml-0.5 h-6 w-6" aria-hidden />
          </span>
        </span>
        <span className="absolute bottom-3 right-3 rounded-lg bg-soft-black/85 px-2 py-1 text-[12px] font-semibold text-warm-white">
          {formatDuration(clip.duration)}
        </span>
      </div>

      <div className="flex flex-col gap-3 p-3">
        <h3 className="line-clamp-2 text-[16px] font-semibold leading-[1.25]">
          {clip.title}
        </h3>
        <button
          type="button"
          onClick={() => downloadClip(clip)}
          aria-label={`Download ${clip.title}`}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200",
            "hover:bg-brand-blue-hover outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          )}
        >
          <Download className="h-4 w-4" aria-hidden />
          Download
        </button>
      </div>
    </article>
  );
}
