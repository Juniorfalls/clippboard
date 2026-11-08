"use client";

import { useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Clip } from "@/types/video";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, "0");
  return `${m}:${s}`;
}

export function VideoPreview({ clip }: { clip: Clip }) {
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

