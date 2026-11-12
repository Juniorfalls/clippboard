"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Download,
  FileDown,
  Lock,
  Minus,
  MoreHorizontal,
  Pencil,
  Play,
  Scissors,
  Send,
  Trash2,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { PublishModal, type PublishPayload } from "@/components/PublishModal";
import { TrimModal } from "@/components/TrimModal";
import { VideoPreview } from "@/components/VideoPreview";
import { downloadFCPXML } from "@/lib/fcpxml";
import type { Plan } from "@/lib/plans";
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

function getPredictedAnalytics(score: number) {
  const views =
    score >= 90
        ? "25k – 100k"
        : score >= 80
          ? "10k – 50k"
          : score >= 65
            ? "5k – 20k"
            : score >= 50
              ? "2k – 8k"
              : score >= 35
                ? "800 – 3k"
                : "200 – 1k";
  const direction = score >= 70 ? "up" : score >= 45 ? "flat" : "down";
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const tone =
    score >= 80
      ? {
          icon: "text-emerald-600",
          badge: "bg-emerald-50",
          stroke: "#059669",
          label: "High momentum",
        }
      : score >= 60
        ? {
            icon: "text-brand-blue",
            badge: "bg-brand-blue-light/60",
            stroke: "#3B82F6",
            label: "Strong interest",
          }
        : {
            icon: "text-amber-600",
            badge: "bg-amber-50",
            stroke: "#D97706",
            label: "Niche reach",
          };

  const drift = (score - 50) / 50;
  const points = Array.from({ length: 7 }, (_, index) => {
    const y = Math.min(
      21,
      Math.max(3, 14 - drift * (index - 3) * 2.2 + (index % 2 ? 1.5 : -1.5))
    );
    return `${index * 6.5},${y.toFixed(1)}`;
  }).join(" ");

  return { views, Icon, tone, points };
}

export async function downloadClip(
  clip: Clip,
  { silent = false }: { silent?: boolean } = {}
) {
  const downloadUrl = clip.storageUrl ?? clip.url;

  if (!downloadUrl) {
    if (!silent) toast.error("This clip is not ready yet");
    return false;
  }

  try {
    const res = await fetch(downloadUrl);
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
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-red-50 p-4 text-center">
      <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-red-600">
        Processing failed
      </span>
      <p className="max-w-[200px] text-[11px] font-medium leading-relaxed text-red-700/70">
        Please generate this clip again.
      </p>
    </div>
  );
}

export function ClipCard({
  clip,
  index,
  progress,
  onTrim,
  onSchedule,
  onRename,
  onDelete,
  transcript,
  plan,
  userId,
}: {
  clip: Clip;
  index: number;
  progress: number;
  onTrim?: (clip: Clip) => void;
  onSchedule?: (clip: Clip, payload: PublishPayload) => void;
  onRename?: (clip: Clip) => void;
  onDelete?: (clip: Clip) => void;
  transcript?: TranscriptSegment[];
  plan: Plan;
  userId: string;
}) {
  const [isTrimOpen, setIsTrimOpen] = useState(false);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [reasonPinned, setReasonPinned] = useState(false);
  const [reasonHovered, setReasonHovered] = useState(false);
  const showReason = reasonPinned || reasonHovered;
  const hasVideoUrl = Boolean(clip.storageUrl || clip.url);
  const isScheduled = clip.status === "scheduled";
  const isCompleted = clip.status === "completed" && hasVideoUrl;
  const isUploadFailed = clip.status === "error" && hasVideoUrl;
  const isReady =
    hasVideoUrl && (isCompleted || isScheduled || isUploadFailed);
  const isMissingVideo =
    !hasVideoUrl &&
    (clip.status === "completed" ||
      clip.status === "scheduled" ||
      clip.status === "error");
  const canPublish = Boolean(
    clip.storageUrl || clip.url?.startsWith("https://")
  );
  const isProcessing = clip.status === "processing";

  return (
    <article className="flex w-full flex-col overflow-hidden rounded-3 border border-gray-200 bg-white">
      <div className="relative aspect-[9/16]">
        {isReady ? (
          <VideoPreview clip={clip} />
        ) : isProcessing ? (
          <ProcessingPreview clip={clip} index={index} progress={progress} />
        ) : clip.status === "error" || isMissingVideo ? (
          <ErrorPreview />
        ) : (
          <PendingPreview index={index} />
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="relative flex items-center justify-between gap-2">
          <button
            type="button"
            onMouseEnter={() => setReasonHovered(true)}
            onMouseLeave={() => setReasonHovered(false)}
            onFocus={() => setReasonHovered(true)}
            onBlur={() => setReasonHovered(false)}
            onClick={() => setReasonPinned((current) => !current)}
            aria-expanded={showReason}
            aria-describedby={showReason ? `engagement-reason-${clip.id}` : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-brand-blue-light bg-gradient-to-r from-brand-blue-light/80 to-emerald-100 px-2.5 py-1 text-left text-[12px] font-semibold text-soft-black shadow-[0_0_18px_rgba(59,130,246,0.35)] duration-200",
              focusRing
            )}
          >
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand-blue" aria-hidden />
            {clip.engagementScore} Engagement Score
          </button>
          <span className="shrink-0 rounded-lg bg-warm-white px-2 py-1 text-[12px] font-semibold text-soft-black/70">
            {formatDuration(clip.duration)}
          </span>
          {showReason && (
            <div
              id={`engagement-reason-${clip.id}`}
              role="tooltip"
              className="absolute left-0 right-0 top-full z-20 mt-2 rounded-2 border border-border-gray bg-white p-3 text-left text-[12px] font-medium leading-relaxed text-soft-black shadow-lg"
            >
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-brand-blue">
                Why it works
              </span>
              {clip.viralityReason || "The AI did not provide a reason."}
            </div>
          )}
        </div>

        {(() => {
          const analytics = getPredictedAnalytics(clip.engagementScore);
          const TrendIcon = analytics.Icon;
          return (
            <div
              className="flex items-center justify-between gap-3 rounded-2 bg-warm-white px-3 py-2.5"
              aria-label={`Predicted views ${analytics.views}. ${analytics.tone.label}.`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    analytics.tone.badge,
                    analytics.tone.icon
                  )}
                >
                  <TrendIcon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[9px] font-semibold uppercase tracking-wide text-soft-black/45">
                    Predicted views
                  </p>
                  <p className="truncate text-[12px] font-bold text-soft-black">
                    {analytics.views}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-0.5">
                <svg
                  viewBox="0 0 40 24"
                  className="h-7 w-16"
                  role="img"
                  aria-label={`${analytics.tone.label} trend`}
                >
                  <polyline
                    points={analytics.points}
                    fill="none"
                    stroke={analytics.tone.stroke}
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span
                  className={cn(
                    "text-[9px] font-semibold",
                    analytics.tone.icon
                  )}
                >
                  {analytics.tone.label}
                </span>
              </div>
            </div>
          );
        })()}

        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 text-[16px] font-semibold leading-[1.25]">
            {clip.title}
          </h3>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={`More options for ${clip.title}`}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-soft-black/60 duration-200 hover:bg-warm-white hover:text-soft-black",
                  focusRing
                )}
              >
                <MoreHorizontal className="h-4 w-4" aria-hidden />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                sideOffset={6}
                className="z-50 min-w-[210px] overflow-hidden rounded-xl border border-border-gray bg-white p-1 shadow-xl"
              >
                <DropdownMenu.Item
                  onSelect={() => void downloadClip(clip)}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-soft-black outline-none duration-200",
                    "data-[highlighted]:bg-warm-white",
                    "focus-visible:ring-2 focus-visible:ring-brand-blue"
                  )}
                >
                  <Download className="h-4 w-4 text-brand-blue" aria-hidden />
                  Download
                </DropdownMenu.Item>

                {onSchedule && canPublish && !isScheduled && (
                  <DropdownMenu.Item
                    onSelect={() => window.setTimeout(() => setIsPublishOpen(true), 0)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-soft-black outline-none duration-200",
                      "data-[highlighted]:bg-warm-white",
                      "focus-visible:ring-2 focus-visible:ring-brand-blue"
                    )}
                  >
                    <Send className="h-4 w-4 text-brand-blue" aria-hidden />
                    Publish
                  </DropdownMenu.Item>
                )}

                {onRename && (
                  <DropdownMenu.Item
                    onSelect={() => window.setTimeout(() => onRename(clip), 0)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-soft-black outline-none duration-200",
                      "data-[highlighted]:bg-warm-white",
                      "focus-visible:ring-2 focus-visible:ring-brand-blue"
                    )}
                  >
                    <Pencil className="h-4 w-4 text-brand-blue" aria-hidden />
                    Rename
                  </DropdownMenu.Item>
                )}

                {onDelete && (
                  <DropdownMenu.Item
                    onSelect={() => window.setTimeout(() => onDelete(clip), 0)}
                    className={cn(
                      "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-red-600 outline-none duration-200",
                      "data-[highlighted]:bg-red-50",
                      "focus-visible:ring-2 focus-visible:ring-red-500"
                    )}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                    Delete
                  </DropdownMenu.Item>
                )}

                <DropdownMenu.Item
                  onSelect={() => {
                    if (plan !== "agency") {
                      toast.error("Final Cut Pro export is an Agency feature", {
                        description: "Upgrade to Agency to export FCPXML.",
                      });
                      return;
                    }

                    downloadFCPXML(clip, transcript ?? []);
                    toast.success("Final Cut Pro project exported", {
                      description: `${clip.title}.fcpxml`,
                    });
                  }}
                  className={cn(
                    "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-soft-black outline-none duration-200",
                    "data-[highlighted]:bg-warm-white",
                    "focus-visible:ring-2 focus-visible:ring-brand-blue"
                  )}
                >
                  {plan === "agency" ? (
                    <FileDown className="h-4 w-4 text-brand-blue" aria-hidden />
                  ) : (
                    <Lock className="h-4 w-4 text-soft-black/40" aria-hidden />
                  )}
                  Export to Final Cut Pro
                  {plan !== "agency" && (
                    <span className="ml-auto rounded-full bg-warm-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-soft-black/50">
                      Agency
                    </span>
                  )}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {isProcessing ? (
          <p className="text-[12px] font-normal text-soft-black/60">
            Browser rendering in progress. Please keep tab open.
          </p>
        ) : isReady ? (
          <div className="flex flex-col gap-2">
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
            {isScheduled ? (
              <span className="inline-flex items-center justify-center gap-2 rounded-2 border border-brand-blue-light bg-brand-blue-light/60 px-3 py-2.5 text-[12px] font-semibold text-soft-black">
                <Send className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
                Scheduled
              </span>
            ) : !canPublish ? (
              <span className="inline-flex items-center justify-center gap-2 rounded-2 border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700">
                <Send className="h-3.5 w-3.5" aria-hidden />
                Publish unavailable
              </span>
            ) : (
              onSchedule && (
                <button
                  type="button"
                  onClick={() => setIsPublishOpen(true)}
                  aria-label={`Publish ${clip.title}`}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-2 border border-border-gray bg-white px-3 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                    focusRing
                  )}
                >
                  <Send className="h-4 w-4" aria-hidden />
                  Publish
                </button>
              )
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

      {onSchedule && (
        <PublishModal
          clip={clip}
          userId={userId}
          open={isPublishOpen}
          onOpenChange={setIsPublishOpen}
          onScheduled={onSchedule}
        />
      )}
    </article>
  );
}
