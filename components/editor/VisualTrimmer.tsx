"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Play, Scissors } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTimecode } from "@/services/video/filmstrip";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

type TrimClip = {
  id: string;
  name: string;
  kind: "video" | "image";
  duration: number;
  startTime?: number;
  endTime?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function VisualTrimmer({
  clip,
  frames,
  loadingFrames,
  isDirty,
  onApply,
  onDirtyChange,
  onPreviewTime,
}: {
  clip: TrimClip | null;
  frames: string[];
  loadingFrames: boolean;
  isDirty: boolean;
  onApply: (clipId: string, startTime: number, endTime: number) => void;
  onDirtyChange: (dirty: boolean) => void;
  onPreviewTime: (time: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const duration = clip?.duration ?? 0;

  useEffect(() => {
    if (!clip) return;
    setStart(clamp(clip.startTime ?? 0, 0, duration));
    setEnd(clamp(clip.endTime ?? duration, 0, duration));
    setDragging(null);
  }, [clip?.id, clip?.startTime, clip?.endTime, clip?.duration, duration]);

  const startPercent = duration > 0 ? (start / duration) * 100 : 0;
  const endPercent = duration > 0 ? (end / duration) * 100 : 100;

  const selectedDuration = useMemo(
    () => Math.max(end - start, 0),
    [start, end]
  );

  useEffect(() => {
    if (!dragging) return;

    function handleMove(event: PointerEvent) {
      const track = trackRef.current;
      if (!track || duration <= 0) return;

      const rect = track.getBoundingClientRect();
      const ratio = clamp((event.clientX - rect.left) / rect.width, 0, 1);
      const time = Math.round(ratio * duration * 10) / 10;

      if (dragging === "start") {
        const next = clamp(time, 0, Math.max(end - 0.1, 0));
        setStart(next);
        onDirtyChange(true);
        onPreviewTime(next);
      } else {
        const next = clamp(time, Math.min(start + 0.1, duration), duration);
        setEnd(next);
        onDirtyChange(true);
        onPreviewTime(Math.max(next - 0.1, start));
      }
    }

    function handleUp() {
      setDragging(null);
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);

    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, [dragging, duration, end, onPreviewTime, start]);

  if (!clip) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2 border border-dashed border-white/15 bg-soft-black p-8 text-center">
        <Scissors className="h-6 w-6 text-brand-blue" aria-hidden />
        <p className="text-[13px] font-semibold text-warm-white">
          Select a clip on the timeline to trim.
        </p>
        <p className="text-[11px] text-warm-white/50">
          Frames will appear here for frame-by-frame trimming.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2 border border-white/10 bg-soft-black p-3 text-warm-white">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13px] font-semibold">
          {clip.name}
        </p>
        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warm-white/70">
          {clip.kind === "video" ? "Video" : "Image"}
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-warm-white/40">
            Start
          </span>
          <span className="font-mono text-[14px] font-bold text-brand-blue">
            {formatTimecode(start)}
          </span>
        </div>

        <button
          type="button"
          onClick={() => onPreviewTime(start)}
          aria-label="Preview from the trim start"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full bg-brand-blue text-soft-black duration-200 hover:bg-brand-blue-hover",
            focusRing
          )}
        >
          <Play className="h-4 w-4 fill-current" aria-hidden />
        </button>

        <div className="flex flex-col items-end">
          <span className="text-[9px] font-semibold uppercase tracking-wide text-warm-white/40">
            End
          </span>
          <span className="font-mono text-[14px] font-bold text-brand-blue">
            {formatTimecode(end)}
          </span>
        </div>
      </div>

      <div
        ref={trackRef}
        className="relative h-20 w-full select-none overflow-hidden rounded-lg bg-black/60"
      >
        {frames.length > 0 ? (
          <div className="absolute inset-0 flex" aria-hidden>
            {frames.map((frame, index) => (
              <span
                key={`${clip.id}-frame-${index}`}
                className="h-full flex-1 bg-cover bg-center"
                style={{ backgroundImage: `url(${frame})` }}
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-[11px] text-warm-white/40">
            {loadingFrames ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Extracting frames...
              </>
            ) : (
              "No frames available for this clip."
            )}
          </div>
        )}

        <div
          className="pointer-events-none absolute inset-y-0 left-0 bg-black/65"
          style={{ width: `${startPercent}%` }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 bg-black/65"
          style={{ width: `${100 - endPercent}%` }}
          aria-hidden
        />
        <div
          className="pointer-events-none absolute inset-y-0 border-y-2 border-brand-blue"
          style={{
            left: `${startPercent}%`,
            width: `${Math.max(endPercent - startPercent, 0)}%`,
          }}
          aria-hidden
        />

        {["start", "end"].map((handle) => {
          const isStart = handle === "start";
          const percent = isStart ? startPercent : endPercent;
          const value = isStart ? start : end;
          return (
            <button
              key={handle}
              type="button"
              role="slider"
              aria-label={`${isStart ? "Trim start" : "Trim end"} time`}
              aria-valuemin={0}
              aria-valuemax={Math.round(duration * 10) / 10}
              aria-valuenow={Math.round(value * 10) / 10}
              aria-valuetext={formatTimecode(value)}
              onPointerDown={(event) => {
                event.preventDefault();
                setDragging(isStart ? "start" : "end");
              }}
              onKeyDown={(event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                  return;
                }
                event.preventDefault();
                const delta = event.key === "ArrowRight" ? 0.1 : -0.1;
                if (isStart) {
                  const next = clamp(start + delta, 0, Math.max(end - 0.1, 0));
                  setStart(next);
                  onDirtyChange(true);
                  onPreviewTime(next);
                } else {
                  const next = clamp(
                    end + delta,
                    Math.min(start + 0.1, duration),
                    duration
                  );
                  setEnd(next);
                  onDirtyChange(true);
                }
              }}
              className={cn(
                "absolute inset-y-0 z-10 w-3 cursor-ew-resize rounded-full border-2 border-white bg-brand-blue shadow-lg",
                isStart ? "-translate-x-1/2" : "translate-x-1/2",
                focusRing
              )}
              style={{ left: `${percent}%` }}
            >
              <span className="absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/80" />
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-warm-white/50">
          Selection · {formatTimecode(selectedDuration)}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setStart(0);
              setEnd(duration);
              onDirtyChange(true);
              onPreviewTime(0);
            }}
            className={cn(
              "rounded-lg border border-white/15 px-3 py-1.5 text-[11px] font-semibold text-warm-white/70 duration-200 hover:bg-white/10",
              focusRing
            )}
          >
            Reset
          </button>
          <button
            type="button"
            onClick={() => onApply(clip.id, start, end)}
            disabled={!isDirty && start === (clip.startTime ?? 0) && end === (clip.endTime ?? duration)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg bg-brand-blue px-3 py-1.5 text-[11px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-warm-white/40",
              focusRing
            )}
          >
            <Scissors className="h-3.5 w-3.5" aria-hidden />
            Apply Trim
          </button>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-warm-white/35">
        Drag the handles or select and use the arrow keys. Playback and export
        both respect the trimmed range.
      </p>
    </div>
  );
}
