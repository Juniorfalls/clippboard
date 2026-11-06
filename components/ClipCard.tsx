"use client";

import { useRef, useState } from "react";
import { Download, Pause, Play, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Clip } from "@/types/video";

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

async function downloadClip(clip: Clip) {
  if (!clip.url) {
    toast.error("This clip is not ready yet");
    return;
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
    toast.success("Download started", { description: clip.title });
  } catch {
    toast.error("Download failed", {
      description: "The rendered clip could not be downloaded.",
    });
  }
}

function VideoPreview({ clip }: { clip: Clip }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(clip.duration);

  function togglePlayback() {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      void video.play().catch(() => {
        toast.error("Preview could not start");
      });
    } else {
      video.pause();
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }

  return (
    <div className="relative h-full w-full bg-soft-black">
      <video
        ref={videoRef}
        src={clip.url}
        aria-label={`Preview of ${clip.title}`}
        playsInline
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setDuration(value);
        }}
        className="h-full w-full cursor-pointer object-cover"
      />

      {!isPlaying && (
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={`Play ${clip.title}`}
          className={cn(
            "absolute inset-0 m-auto flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-soft-black shadow-lg duration-200 hover:bg-white",
            focusRing
          )}
        >
          <Play className="ml-0.5 h-6 w-6" aria-hidden />
        </button>
      )}

      <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-gradient-to-t from-soft-black/85 to-transparent p-3 pt-8 text-warm-white">
        <button
          type="button"
          onClick={togglePlayback}
          aria-label={isPlaying ? `Pause ${clip.title}` : `Play ${clip.title}`}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-warm-white/15 duration-200 hover:bg-warm-white/25",
            focusRing
          )}
        >
          {isPlaying ? (
            <Pause className="h-4 w-4" aria-hidden />
          ) : (
            <Play className="ml-0.5 h-4 w-4" aria-hidden />
          )}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={isMuted ? "Unmute clip" : "Mute clip"}
          aria-pressed={isMuted}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-warm-white/15 duration-200 hover:bg-warm-white/25",
            focusRing
          )}
        >
          {isMuted ? (
            <VolumeX className="h-4 w-4" aria-hidden />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden />
          )}
        </button>
        <span className="ml-auto text-[12px] font-semibold tabular-nums">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>
    </div>
  );
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
}: {
  clip: Clip;
  index: number;
  progress: number;
}) {
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
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-[1.25]">
            {clip.title}
          </h3>
          <span className="shrink-0 rounded-lg bg-warm-white px-2 py-1 text-[12px] font-semibold text-soft-black/70">
            {formatDuration(clip.duration)}
          </span>
        </div>

        {isProcessing ? (
          <p className="text-[12px] font-normal text-soft-black/60">
            Browser rendering in progress. Please keep tab open.
          </p>
        ) : isCompleted ? (
          <button
            type="button"
            onClick={() => void downloadClip(clip)}
            aria-label={`Download ${clip.title}`}
            className={cn(
              "inline-flex w-full items-center justify-center gap-2 rounded-2 bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
              focusRing
            )}
          >
            <Download className="h-4 w-4" aria-hidden />
            Download
          </button>
        ) : (
          <p className="text-[12px] font-normal text-soft-black/60">
            {clip.status === "error" ? "Please generate this clip again." : "Waiting to render."}
          </p>
        )}
      </div>
    </article>
  );
}
