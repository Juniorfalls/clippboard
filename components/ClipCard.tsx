"use client";

import { useState } from "react";
import { Download, Play, Scissors, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { TrimModal } from "@/components/TrimModal";
import { VideoPreview } from "@/components/VideoPreview";
import { cn } from "@/lib/utils";
import type { Clip, TranscriptSegment } from "@/types/video";

const THUMB_GRADIENTS = [
  "from-blue-200 to-blue-500",
  "from-brand-blue-light to-blue-400",
  "from-blue-300 to-blue-600",
  "from-sky-200 to-blue-500",
  "from-indigo-200 to-blue-500",
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export async function downloadClip(
  clip: Clip,
  { silent = false }: { silent?: boolean } = {}
) {
  if (!clip.url) {
    if (!silent) toast.error("This clip is not ready yet");
    return false;
  }

  try {
    const res = await fetch(clip.url);
    if (!res.ok) throw new Error("missing");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${clip.title.replace(/[^\w\s-]/g, "").trim() || "clip"}.mp4`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
    if (!silent) toast.success("Download started", { description: clip.title });
    return true;
  } catch {
    if (!silent) {
      toast.error("Download failed", {
        description: "The rendered clip could not be downloaded.",
      });
    }
    return false;
  }
}

function ProcessingPreview({
  clip,
  index,
  progress,
}: {
  clip: Clip;
  index: number;
  progress: number;
}) {
  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col justify-end bg-gradient-to-br p-4",
        THUMB_GRADIENTS[index % THUMB_GRADIENTS.length]
      )}
    >
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-white/90">
        <Play className="ml-0.5 h-6 w-6 text-soft-black" aria-hidden />
      </div>
      <div className="space-y-2 rounded-xl bg-white/90 p-3">
        <div className="flex items-center justify-between text-[12px] font-semibold text-soft-black">
          <span>Rendering</span>
          <span>{progress}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
          aria-valuetext={`${progress}% complete`}
          aria-label={`Rendering ${clip.title}`}
          className="h-2 w-full overflow-hidden rounded-full bg-gray-200"
        >
          <div
            className="h-full rounded-full bg-brand-blue transition-[width] duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function PendingPreview({ index }: { index: number }) {
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br",
        THUMB_GRADIENTS[index % THUMB_GRADIENTS.length]
      )}
    >
      <span className="rounded-full bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-soft-black">
        Queued
      </span>
    </div>
  );
}

function ErrorPreview() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-red-50 p-4">
      <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600">
        Rendering failed
      </span>
    </div>
  );
}

export function ClipCard({
  clip,
  index,
  progress,
  onTrim,
  transcript,
}: {
  clip: Clip;
  index: number;
  progress: number;
  onTrim?: (clip: Clip) => void;
  transcript?: TranscriptSegment[];
}) {
  const [isTrimOpen, setIsTrimOpen] = useState(false);
  const isCompleted = clip.status === "completed" && Boolean(clip.url);
  const isProcessing = clip.status === "processing";

  return (
    <article className="flex flex-col overflow-hidden rounded-3 border-4 border-brand-blue-light bg-white">
      <div className="relative aspect-[9/16]">
        {isCompleted ? (
          <VideoPreview clip={clip} />
        ) : isProcessing ? (
          <ProcessingPreview clip={clip} index={index} progress={progress} />
        ) : clip.status === "error" ? (
          <ErrorPreview />
        ) : (
          <PendingPreview index={index} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-blue-light bg-gradient-to-r from-brand-blue-light/80 to-emerald-100 px-2.5 py-1 text-[12px] font-semibold text-soft-black shadow-[0_0_18px_rgba(59,130,246,0.35)]">
            <Sparkles className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
            {clip.viralityScore} Viral Score
          </span>
          <span className="shrink-0 rounded-lg bg-warm-white px-2 py-1 text-[12px] font-semibold text-soft-black/70">
            {formatDuration(clip.duration)}
          </span>
        </div>

        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-[1.25]">
            {clip.title}
          </h3>
        </div>

        {isProcessing ? (
          <p className="text-[12px] font-normal text-soft-black/60">
            Browser rendering in progress. Please keep tab open.
          </p>
        ) : isCompleted ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void downloadClip(clip)}
              aria-label={`Download ${clip.title}`}
              className={cn(
                "inline-flex w-full items-center justify-center gap-2 rounded-2 bg-brand-blue px-3 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
                focusRing
              )}
            >
              <Download className="h-4 w-4" aria-hidden />
              Download
            </button>
            {onTrim && (
              <button
                type="button"
                onClick={() => setIsTrimOpen(true)}
                aria-label={`Trim ${clip.title}`}
                className={cn(
                  "inline-flex w-full items-center justify-center gap-2 rounded-2 border border-border-gray bg-white px-3 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                  focusRing
                )}
              >
                <Scissors className="h-4 w-4" aria-hidden />
                Trim
              </button>
            )}
          </div>
        ) : (
          <p className="text-[12px] font-normal text-soft-black/60">
            {clip.status === "error" ? "Please generate this clip again." : "Waiting to render."}
          </p>
        )}
      </div>

      {onTrim && (
        <TrimModal
          clip={clip}
          open={isTrimOpen}
          onOpenChange={setIsTrimOpen}
          onSave={onTrim}
          transcript={transcript}
        />
      )}
    </article>
  );
}
