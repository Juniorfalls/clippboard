"use client";

import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Scissors, X } from "lucide-react";
import { VideoPreview } from "@/components/VideoPreview";
import { cn } from "@/lib/utils";
import type { Clip } from "@/types/video";

const MIN_DURATION = 1;
const BARS = Array.from({ length: 72 }, (_, index) => {
  const wave = Math.sin(index * 0.55) * 0.5 + Math.cos(index * 0.19) * 0.5;
  return 22 + Math.abs(wave) * 70;
});

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

type TrimModalProps = {
  clip: Clip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (clip: Clip) => void;
};

export function TrimModal({ clip, open, onOpenChange, onSave }: TrimModalProps) {
  const boundsRef = useRef({ start: clip.startTime, end: clip.endTime });
  const trackRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(clip.startTime);
  const [end, setEnd] = useState(clip.endTime);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  const bounds = boundsRef.current;
  const range = Math.max(bounds.end - bounds.start, MIN_DURATION);

  useEffect(() => {
    if (!open) return;
    setStart(clip.startTime);
    setEnd(clip.endTime);
  }, [open, clip.startTime, clip.endTime]);

  useEffect(() => {
    if (!dragging) return;

    function handleMove(event: PointerEvent) {
      const track = trackRef.current;
      if (!track) return;

      const rect = track.getBoundingClientRect();
      const ratio = Math.min(
        Math.max((event.clientX - rect.left) / rect.width, 0),
        1
      );
      const time = bounds.start + ratio * range;

      if (dragging === "start") {
        setStart(
          Math.max(bounds.start, Math.min(time, end - MIN_DURATION))
        );
      } else {
        setEnd(Math.min(bounds.end, Math.max(time, start + MIN_DURATION)));
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
  }, [bounds.start, bounds.end, dragging, end, range, start]);

  function nudge(handle: "start" | "end", delta: number) {
    if (handle === "start") {
      setStart((current) =>
        Math.max(bounds.start, Math.min(current + delta, end - MIN_DURATION))
      );
    } else {
      setEnd((current) =>
        Math.min(bounds.end, Math.max(current + delta, start + MIN_DURATION))
      );
    }
  }

  function handleSave() {
    onSave({
      ...clip,
      startTime: Math.round(start * 10) / 10,
      endTime: Math.round(end * 10) / 10,
      duration: Math.round((end - start) * 10) / 10,
    });
    onOpenChange(false);
  }

  const leftPercent = ((start - bounds.start) / range) * 100;
  const rightPercent = ((bounds.end - end) / range) * 100;
  const selectedPercent = Math.max(100 - leftPercent - rightPercent, 0);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-soft-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2",
            "max-h-[92vh] overflow-y-auto rounded-3 border border-border-gray bg-white p-5 shadow-xl md:p-6",
            focusRing
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-blue">
                <Scissors className="h-4 w-4" aria-hidden />
                Trim clip
              </span>
              <Dialog.Title className="text-[24px] font-bold leading-[1.25]">
                {clip.title}
              </Dialog.Title>
              <Dialog.Description className="text-[14px] text-soft-black/60">
                Drag the handles to choose the exact start and end of this clip.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close trim editor"
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-gray bg-warm-white text-soft-black duration-200 hover:bg-white",
                  focusRing
                )}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[200px_1fr] md:items-center">
            <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-2 border-4 border-brand-blue-light shadow-xl">
              <div className="aspect-[9/16]">
                <VideoPreview clip={clip} />
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3 text-[14px] font-semibold">
                <span className="inline-flex items-center gap-2 rounded-full bg-warm-white px-3 py-1.5">
                  <span className="h-2 w-2 rounded-full bg-brand-blue" aria-hidden />
                  Start {formatTime(start)}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full bg-warm-white px-3 py-1.5">
                  End {formatTime(end)}
                  <span className="h-2 w-2 rounded-full bg-brand-blue" aria-hidden />
                </span>
              </div>

              <div
                ref={trackRef}
                className="relative h-24 select-none overflow-hidden rounded-2 border border-border-gray bg-warm-white"
              >
                <div
                  className="absolute inset-0 flex items-center gap-[2px] px-1 opacity-70"
                  aria-hidden
                >
                  {BARS.map((height, index) => (
                    <span
                      key={index}
                      className="flex-1 rounded-full bg-brand-blue-light"
                      style={{ height: `${height}%` }}
                    />
                  ))}
                </div>

                <div
                  className="absolute inset-y-0 left-0 bg-soft-black/30"
                  style={{ width: `${leftPercent}%` }}
                  aria-hidden
                />
                <div
                  className="absolute inset-y-0 right-0 bg-soft-black/30"
                  style={{ width: `${rightPercent}%` }}
                  aria-hidden
                />
                <div
                  className="absolute inset-y-0 border-y-2 border-brand-blue bg-brand-blue/15"
                  style={{
                    left: `${leftPercent}%`,
                    width: `${selectedPercent}%`,
                  }}
                  aria-hidden
                />

                <button
                  type="button"
                  role="slider"
                  aria-label="Clip start time"
                  aria-valuemin={Math.round(bounds.start)}
                  aria-valuemax={Math.round(end - MIN_DURATION)}
                  aria-valuenow={Math.round(start)}
                  aria-valuetext={formatTime(start)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDragging("start");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault();
                      nudge("start", event.key === "ArrowRight" ? 1 : -1);
                    }
                  }}
                  className={cn(
                    "absolute inset-y-0 z-10 w-5 -translate-x-1/2 cursor-ew-resize rounded-full border-2 border-white bg-brand-blue shadow-lg",
                    focusRing
                  )}
                  style={{ left: `${leftPercent}%` }}
                >
                  <span className="absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/80" />
                </button>

                <button
                  type="button"
                  role="slider"
                  aria-label="Clip end time"
                  aria-valuemin={Math.round(start + MIN_DURATION)}
                  aria-valuemax={Math.round(bounds.end)}
                  aria-valuenow={Math.round(end)}
                  aria-valuetext={formatTime(end)}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    setDragging("end");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
                      event.preventDefault();
                      nudge("end", event.key === "ArrowRight" ? 1 : -1);
                    }
                  }}
                  className={cn(
                    "absolute inset-y-0 z-10 w-5 translate-x-1/2 cursor-ew-resize rounded-full border-2 border-white bg-brand-blue shadow-lg",
                    focusRing
                  )}
                  style={{ right: `${rightPercent}%` }}
                >
                  <span className="absolute inset-y-3 left-1/2 w-0.5 -translate-x-1/2 rounded-full bg-white/80" />
                </button>
              </div>

              <div className="flex items-center justify-between text-[12px] font-semibold text-soft-black/60">
                <span>Clip length {Math.max(end - start, 0).toFixed(1)}s</span>
                <span>Drag handles or use arrow keys</span>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-2 border border-border-gray bg-white px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                  focusRing
                )}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSave}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
                focusRing
              )}
            >
              <Scissors className="h-4 w-4" aria-hidden />
              Save Trim
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
