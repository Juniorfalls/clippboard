"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { upload } from "@vercel/blob/client";
import { toast } from "sonner";
import {
  AudioLines,
  Captions,
  Image as ImageIcon,
  Loader2,
  RotateCcw,
  Scissors,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { CustomSelect } from "@/components/CustomSelect";
import { CustomTextArea } from "@/components/CustomTextArea";
import { VideoPreview } from "@/components/VideoPreview";
import { cn } from "@/lib/utils";
import {
  renderThumbnailPreview,
  type ThumbnailLayout,
} from "@/services/video/thumbnail-editor";
import { createClient } from "@/utils/supabase/client";
import type { Clip, TimeRange, TranscriptSegment, Voiceover } from "@/types/video";

const MIN_DURATION = 1;
const BARS = Array.from({ length: 72 }, (_, index) => {
  const wave = Math.sin(index * 0.55) * 0.5 + Math.cos(index * 0.19) * 0.5;
  return 22 + Math.abs(wave) * 70;
});

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const VOICE_OPTIONS = [
  { value: "alloy", label: "Alloy" },
  { value: "echo", label: "Echo" },
  { value: "fable", label: "Fable" },
  { value: "onyx", label: "Onyx" },
  { value: "nova", label: "Nova" },
  { value: "shimmer", label: "Shimmer" },
];

type EditorTab = "timeline" | "transcript" | "voiceover" | "thumbnail";

type ClipWord = {
  key: string;
  word: string;
  start: number;
  end: number;
};

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function mergeRanges(ranges: TimeRange[]) {
  const sorted = [...ranges].sort((a, b) => a.start - b.start);
  return sorted.reduce<TimeRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.05) {
      previous.end = Math.max(previous.end, range.end);
      return merged;
    }

    merged.push({ ...range });
    return merged;
  }, []);
}

function getClipWords(
  transcript: TranscriptSegment[] | undefined,
  clip: Clip
): ClipWord[] {
  if (!transcript?.length) return [];

  const words: ClipWord[] = [];

  transcript.forEach((segment, segmentIndex) => {
    const segmentWords = segment.words?.length
      ? segment.words
      : (() => {
          const tokens = segment.text.trim().split(/\s+/).filter(Boolean);
          const totalWeight = tokens.reduce(
            (sum, token) => sum + token.length + 1,
            0
          );
          let elapsed = 0;

          return tokens.map((token) => {
            const weight = token.length + 1;
            const start =
              segment.start +
              ((segment.end - segment.start) * elapsed) / totalWeight;
            elapsed += weight;
            const end =
              segment.start +
              ((segment.end - segment.start) * elapsed) / totalWeight;
            return { word: token, start, end };
          });
        })();

    segmentWords.forEach((word, wordIndex) => {
      if (word.end <= clip.startTime || word.start >= clip.endTime) return;

      words.push({
        key: `${segmentIndex}-${wordIndex}`,
        word: word.word,
        start: word.start,
        end: word.end,
      });
    });
  });

  return words;
}

const THUMBNAIL_LAYOUTS: Array<{ id: ThumbnailLayout; label: string }> = [
  { id: "split", label: "Split Screen" },
  { id: "banner", label: "Bottom Banner" },
  { id: "center", label: "Center Focus" },
];

const THUMBNAIL_BACKGROUNDS = [
  { label: "Brand Blue", value: "#3B82F6" },
  { label: "Soft Black", value: "#1C1C1C" },
  { label: "White", value: "#FFFFFF" },
];

const THUMBNAIL_TEXT_COLORS = [
  { label: "White", value: "#FFFFFF" },
  { label: "Black", value: "#1C1C1C" },
];

type TrimModalProps = {
  clip: Clip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (clip: Clip) => void;
  transcript?: TranscriptSegment[];
  userId: string;
  onThumbnailSaved?: (thumbnailUrl: string) => void;
};

export function TrimModal({
  clip,
  open,
  onOpenChange,
  onSave,
  transcript,
  userId,
  onThumbnailSaved,
}: TrimModalProps) {
  const boundsRef = useRef({ start: clip.startTime, end: clip.endTime });
  const trackRef = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(clip.startTime);
  const [end, setEnd] = useState(clip.endTime);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);
  const [activeTab, setActiveTab] = useState<EditorTab>("timeline");
  const [selectedWordKeys, setSelectedWordKeys] = useState<Set<string>>(
    new Set()
  );
  const [removedWordKeys, setRemovedWordKeys] = useState<Set<string>>(
    new Set()
  );
  const [voice, setVoice] = useState("alloy");
  const [script, setScript] = useState("");
  const [voiceover, setVoiceover] = useState<Voiceover | null>(null);
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [removeFiller, setRemoveFiller] = useState(false);
  const [thumbnailText, setThumbnailText] = useState(
    clip.hookText || clip.title
  );
  const [thumbnailLayout, setThumbnailLayout] =
    useState<ThumbnailLayout>("split");
  const [thumbnailBackground, setThumbnailBackground] =
    useState("#3B82F6");
  const [thumbnailTextColor, setThumbnailTextColor] = useState("#FFFFFF");
  const [isSavingThumbnail, setIsSavingThumbnail] = useState(false);
  const [thumbnailMediaVersion, setThumbnailMediaVersion] = useState(0);
  const thumbnailCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailMediaRef = useRef<HTMLVideoElement | null>(null);

  const bounds = boundsRef.current;
  const range = Math.max(bounds.end - bounds.start, MIN_DURATION);
  const clipWords = useMemo(
    () => getClipWords(transcript, clip),
    [transcript, clip]
  );

  useEffect(() => {
    if (!open) return;
    setStart(clip.startTime);
    setEnd(clip.endTime);
    setActiveTab("timeline");
    setSelectedWordKeys(new Set());
    setVoice(clip.voiceover?.voice ?? "alloy");
    setScript(clip.voiceover?.script ?? "");
    setVoiceover(clip.voiceover ?? null);
    setIsGeneratingVoiceover(false);
    setThumbnailText(clip.hookText || clip.title);
    setThumbnailLayout("split");
    setThumbnailBackground("#3B82F6");
    setThumbnailTextColor("#FFFFFF");
    setIsSavingThumbnail(false);
    setRemoveFiller(
      clip.removeFiller ?? Boolean(clip.fillerCuts?.length)
    );

    const removed = new Set<string>();
    clipWords.forEach((word) => {
      const isRemoved = clip.cutRanges?.some(
        (range) =>
          word.start >= range.start - 0.03 && word.end <= range.end + 0.03
      );
      if (isRemoved) removed.add(word.key);
    });
    setRemovedWordKeys(removed);
  }, [
    open,
    clip.startTime,
    clip.endTime,
    clip.cutRanges,
    clipWords,
    clip.voiceover,
    clip.fillerCuts,
    clip.removeFiller,
  ]);

  useEffect(() => {
    if (!open || activeTab !== "thumbnail") return;

    const source = clip.storageUrl ?? clip.url;
    thumbnailMediaRef.current = null;
    if (!source) {
      setThumbnailMediaVersion((version) => version + 1);
      return;
    }

    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const seekToStart = () => {
      if (cancelled) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const target = Math.min(
        Math.max(clip.startTime, 0),
        Math.max(duration - 0.1, 0)
      );

      if (Math.abs(video.currentTime - target) > 0.01) {
        video.currentTime = target;
        return;
      }

      thumbnailMediaRef.current = video;
      setThumbnailMediaVersion((version) => version + 1);
    };

    video.onloadeddata = seekToStart;
    video.onseeked = () => {
      if (cancelled) return;
      thumbnailMediaRef.current = video;
      setThumbnailMediaVersion((version) => version + 1);
    };
    video.onerror = () => {
      if (cancelled) return;
      console.warn(
        "[TrimModal] Could not load the clip frame for the thumbnail preview."
      );
      thumbnailMediaRef.current = null;
      setThumbnailMediaVersion((version) => version + 1);
    };

    video.src = source;
    video.load();

    return () => {
      cancelled = true;
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      video.removeAttribute("src");
      video.load();
    };
  }, [activeTab, clip.startTime, clip.storageUrl, clip.url, open]);

  useEffect(() => {
    if (activeTab !== "thumbnail") return;
    const canvas = thumbnailCanvasRef.current;
    if (!canvas) return;

    renderThumbnailPreview(
      canvas,
      thumbnailMediaRef.current,
      thumbnailText,
      thumbnailLayout,
      thumbnailBackground,
      thumbnailTextColor
    );
  }, [
    activeTab,
    thumbnailText,
    thumbnailLayout,
    thumbnailBackground,
    thumbnailTextColor,
    thumbnailMediaVersion,
  ]);

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
        setStart(Math.max(bounds.start, Math.min(time, end - MIN_DURATION)));
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

  function toggleWord(key: string) {
    if (removedWordKeys.has(key)) {
      setRemovedWordKeys((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
      return;
    }

    setSelectedWordKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function deleteSelectedWords() {
    if (selectedWordKeys.size === 0) return;

    setRemovedWordKeys((current) => {
      const next = new Set(current);
      selectedWordKeys.forEach((key) => next.add(key));
      return next;
    });
    setSelectedWordKeys(new Set());
  }

  async function generateVoiceover() {
    const trimmed = script.trim();

    if (!trimmed) {
      toast.error("Add a script first", {
        description: "Write or paste what the voiceover should say.",
      });
      return;
    }

    setIsGeneratingVoiceover(true);

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice, script: trimmed }),
      });
      const data = (await response.json().catch(() => null)) as
        | { audioUrl?: string; error?: string }
        | null;

      if (!response.ok || !data?.audioUrl) {
        throw new Error(data?.error || "Voiceover generation failed.");
      }

      setVoiceover({ voice, script: trimmed, audioUrl: data.audioUrl });
      toast.success("Voiceover generated", {
        description: "Save the clip to mix it into the final render.",
      });
    } catch (error) {
      toast.error("Could not generate voiceover", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsGeneratingVoiceover(false);
    }
  }

  async function handleSaveThumbnail() {
    const canvas = thumbnailCanvasRef.current;
    if (!canvas || isSavingThumbnail) return;

    setIsSavingThumbnail(true);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.92);
      });
      if (!blob || blob.size === 0) {
        throw new Error("The thumbnail could not be generated.");
      }

      const file = new File([blob], `thumbnail-${clip.id}.jpg`, {
        type: "image/jpeg",
      });
      const uploaded = await upload(
        `thumbnails/${userId}/custom-${clip.id}-${Date.now()}.jpg`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: "image/jpeg",
          clientPayload: JSON.stringify({ userId }),
        }
      );

      if (!uploaded.url?.startsWith("https://")) {
        throw new Error("The thumbnail upload did not return a public URL.");
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("clips")
        .update({
          thumbnail_url: uploaded.url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", clip.id)
        .eq("user_id", userId);

      if (error) throw error;

      onThumbnailSaved?.(uploaded.url);
      toast.success("Thumbnail updated!");
      onOpenChange(false);
    } catch (error) {
      console.error("Thumbnail save failed:", error);
      toast.error("Could not save thumbnail", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSavingThumbnail(false);
    }
  }

  function handleSave() {
    const removedWords = clipWords.filter((word) =>
      removedWordKeys.has(word.key)
    );
    const cutRanges = mergeRanges(
      removedWords.map((word) => ({ start: word.start, end: word.end }))
    );

    onSave({
      ...clip,
      startTime: Math.round(start * 10) / 10,
      endTime: Math.round(end * 10) / 10,
      duration: Math.round((end - start) * 10) / 10,
      cutRanges,
      removeFiller,
      voiceover: voiceover ?? undefined,
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
            activeTab === "thumbnail" ? "max-w-3xl" : "max-w-2xl",
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
                Trim the timeline or remove spoken words to tighten this clip.
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

          <div
            role="tablist"
            aria-label="Trim editor mode"
            className="mt-5 flex w-fit flex-wrap items-center gap-1 rounded-full border border-border-gray bg-warm-white p-1"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "timeline"}
              onClick={() => setActiveTab("timeline")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold duration-200",
                activeTab === "timeline"
                  ? "bg-white text-soft-black shadow-sm"
                  : "text-soft-black/60 hover:text-soft-black",
                focusRing
              )}
            >
              <Scissors className="h-4 w-4" aria-hidden />
              Timeline
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "transcript"}
              onClick={() => setActiveTab("transcript")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold duration-200",
                activeTab === "transcript"
                  ? "bg-white text-soft-black shadow-sm"
                  : "text-soft-black/60 hover:text-soft-black",
                focusRing
              )}
            >
              <Captions className="h-4 w-4" aria-hidden />
              Transcript
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "voiceover"}
              onClick={() => setActiveTab("voiceover")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold duration-200",
                activeTab === "voiceover"
                  ? "bg-white text-soft-black shadow-sm"
                  : "text-soft-black/60 hover:text-soft-black",
                focusRing
              )}
            >
              <AudioLines className="h-4 w-4" aria-hidden />
              Voiceover
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "thumbnail"}
              onClick={() => setActiveTab("thumbnail")}
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[14px] font-semibold duration-200",
                activeTab === "thumbnail"
                  ? "bg-white text-soft-black shadow-sm"
                  : "text-soft-black/60 hover:text-soft-black",
                focusRing
              )}
            >
              <ImageIcon className="h-4 w-4" aria-hidden />
              Thumbnail
            </button>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-[200px_1fr] md:items-start">
            {activeTab !== "thumbnail" && (
              <div className="mx-auto w-full max-w-[200px] overflow-hidden rounded-2 border-4 border-brand-blue-light shadow-xl">
                <div className="aspect-[9/16]">
                  <VideoPreview clip={clip} />
                </div>
              </div>
            )}

            {activeTab === "timeline" ? (
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

                <div className="flex items-center justify-between gap-3 rounded-2 border border-border-gray bg-warm-white p-3">
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
                    <div>
                      <p className="text-[14px] font-semibold text-soft-black">
                        Remove Filler Words
                      </p>
                      <p className="text-[12px] text-soft-black/50">
                        {clip.fillerCuts?.length
                          ? `${clip.fillerCuts.length} filler moment${
                              clip.fillerCuts.length === 1 ? "" : "s"
                            } detected by AI.`
                          : "No filler words or bad takes detected."}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={removeFiller}
                    aria-label="Remove filler words"
                    disabled={!clip.fillerCuts?.length}
                    onClick={() => setRemoveFiller((current) => !current)}
                    className={cn(
                      "relative h-7 w-12 shrink-0 rounded-full border duration-200",
                      removeFiller
                        ? "border-brand-blue bg-brand-blue"
                        : "border-border-gray bg-soft-black/15",
                      "disabled:cursor-not-allowed disabled:opacity-50",
                      focusRing
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm duration-200",
                        removeFiller ? "left-[22px]" : "left-[3px]"
                      )}
                    />
                  </button>
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
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight"
                      ) {
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
                      if (
                        event.key === "ArrowLeft" ||
                        event.key === "ArrowRight"
                      ) {
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
            ) : activeTab === "transcript" ? (
              <div className="flex flex-col gap-3">
                <div
                  className="no-scrollbar flex max-h-[260px] flex-wrap content-start gap-1.5 overflow-y-auto rounded-2 border border-border-gray bg-warm-white p-3"
                  aria-label="Clip transcript"
                >
                  {clipWords.length === 0 ? (
                    <p className="text-[14px] text-soft-black/60">
                      No transcript is available for this clip.
                    </p>
                  ) : (
                    clipWords.map((word) => {
                      const selected = selectedWordKeys.has(word.key);
                      const removed = removedWordKeys.has(word.key);

                      return (
                        <button
                          key={word.key}
                          type="button"
                          onClick={() => toggleWord(word.key)}
                          aria-pressed={selected}
                          aria-label={`${removed ? "Restore" : "Select"} ${
                            word.word
                          } at ${formatTime(word.start)}`}
                          className={cn(
                            "inline-flex flex-col items-center rounded-lg border px-2 py-1 text-[14px] font-semibold leading-[1.2] duration-200",
                            "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
                            removed
                              ? "border-transparent bg-transparent text-soft-black/35 line-through hover:bg-white"
                              : selected
                                ? "border-brand-blue bg-brand-blue text-soft-black"
                                : "border-transparent bg-white text-soft-black hover:border-brand-blue-light"
                          )}
                        >
                          <span>{word.word}</span>
                          <span
                            className={cn(
                              "text-[9px] font-normal",
                              selected ? "text-soft-black/60" : "text-soft-black/40"
                            )}
                          >
                            {formatTime(word.start)}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[12px] font-semibold text-soft-black/60">
                    {selectedWordKeys.size} selected · {removedWordKeys.size} deleted
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {removedWordKeys.size > 0 && (
                      <button
                        type="button"
                        onClick={() => setRemovedWordKeys(new Set())}
                        className={cn(
                          "inline-flex items-center justify-center gap-2 rounded-2 border border-border-gray bg-white px-3 py-2 text-[12px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                          focusRing
                        )}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        Restore all
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={deleteSelectedWords}
                      disabled={selectedWordKeys.size === 0}
                      className={cn(
                        "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-3 py-2 text-[12px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
                        "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
                        focusRing
                      )}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete selected
                    </button>
                  </div>
                </div>
                <p className="text-[12px] font-normal text-soft-black/50">
                  Deleted words become jump cuts. Tap a struck-through word to
                  restore it.
                </p>
              </div>
            ) : activeTab === "voiceover" ? (
              <div className="flex flex-col gap-3">
                <CustomSelect
                  label="Voice"
                  value={voice}
                  onValueChange={(value) => {
                    setVoice(value);
                    setVoiceover(null);
                  }}
                  options={VOICE_OPTIONS}
                />
                <CustomTextArea
                  label="Voiceover script"
                  value={script}
                  onChange={(value) => {
                    setScript(value);
                    if (voiceover && value.trim() !== voiceover.script) {
                      setVoiceover(null);
                    }
                  }}
                  placeholder="Paste or write the voiceover script here..."
                  hint="The generated voiceover will be mixed with the clip's original audio."
                  maxLength={1000}
                  rows={5}
                  disabled={isGeneratingVoiceover}
                />
                {voiceover && (
                  <div className="flex items-center justify-between gap-3 rounded-2 border border-brand-blue-light bg-brand-blue-light/50 px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 text-[12px] font-semibold text-soft-black">
                      <AudioLines className="h-4 w-4 text-brand-blue" aria-hidden />
                      Voiceover ready · {voiceover.voice}
                    </span>
                    <button
                      type="button"
                      onClick={() => setVoiceover(null)}
                      className={cn(
                        "rounded-lg px-2 py-1 text-[12px] font-semibold text-soft-black/60 duration-200 hover:bg-white hover:text-soft-black",
                        focusRing
                      )}
                    >
                      Remove
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void generateVoiceover()}
                    disabled={isGeneratingVoiceover || !script.trim()}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
                      "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
                      focusRing
                    )}
                  >
                    <AudioLines className="h-4 w-4" aria-hidden />
                    {isGeneratingVoiceover ? "Generating..." : "Generate voiceover"}
                  </button>
                </div>
                <p className="text-[12px] font-normal text-soft-black/50">
                  Generate the voiceover, then save the clip to re-render with
                  mixed audio.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:col-span-2">
                <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_230px] sm:items-start">
                  <div className="overflow-hidden rounded-2 border-4 border-brand-blue-light bg-warm-white shadow-xl">
                    <canvas
                      ref={thumbnailCanvasRef}
                      width={1280}
                      height={720}
                      className="block aspect-video w-full max-w-[600px]"
                      aria-label="Thumbnail live preview"
                    />
                  </div>

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label
                        htmlFor="thumbnail-headline"
                        className="text-[14px] font-semibold text-soft-black"
                      >
                        Headline
                      </label>
                      <input
                        id="thumbnail-headline"
                        type="text"
                        value={thumbnailText}
                        onChange={(event) =>
                          setThumbnailText(event.target.value.slice(0, 90))
                        }
                        maxLength={90}
                        autoComplete="off"
                        placeholder="Add a bold headline"
                        className={cn(
                          "block w-full rounded-2 border border-border-gray bg-white px-3.5 py-2.5 text-[14px] text-soft-black placeholder:text-soft-black/40 duration-200",
                          focusRing
                        )}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-semibold text-soft-black">
                        Layout
                      </span>
                      <div
                        role="radiogroup"
                        aria-label="Thumbnail layout"
                        className="flex flex-col gap-2"
                      >
                        {THUMBNAIL_LAYOUTS.map((option) => {
                          const active = thumbnailLayout === option.id;
                          return (
                            <button
                              key={option.id}
                              type="button"
                              role="radio"
                              aria-checked={active}
                              onClick={() => setThumbnailLayout(option.id)}
                              className={cn(
                                "rounded-2 border px-3 py-2 text-left text-[13px] font-semibold duration-200",
                                active
                                  ? "border-brand-blue bg-brand-blue-light/60 text-soft-black"
                                  : "border-border-gray bg-white text-soft-black/70 hover:bg-warm-white hover:text-soft-black",
                                focusRing
                              )}
                            >
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-semibold text-soft-black">
                        Background
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {THUMBNAIL_BACKGROUNDS.map((option) => {
                          const active = thumbnailBackground === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              aria-label={`${option.label} background`}
                              onClick={() =>
                                setThumbnailBackground(option.value)
                              }
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-full border-2 duration-200",
                                active
                                  ? "border-brand-blue ring-2 ring-brand-blue-light"
                                  : "border-border-gray hover:border-brand-blue",
                                focusRing
                              )}
                              style={{ backgroundColor: option.value }}
                            >
                              {active && (
                                <span
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    option.value === "#FFFFFF"
                                      ? "bg-soft-black"
                                      : "bg-white"
                                  )}
                                  aria-hidden
                                />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-[14px] font-semibold text-soft-black">
                        Text color
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {THUMBNAIL_TEXT_COLORS.map((option) => {
                          const active = thumbnailTextColor === option.value;
                          return (
                            <button
                              key={option.value}
                              type="button"
                              aria-pressed={active}
                              onClick={() =>
                                setThumbnailTextColor(option.value)
                              }
                              className={cn(
                                "flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold duration-200",
                                active
                                  ? "border-brand-blue bg-brand-blue-light/60 text-soft-black"
                                  : "border-border-gray bg-white text-soft-black/70 hover:bg-warm-white",
                                focusRing
                              )}
                            >
                              <span
                                className="h-3.5 w-3.5 rounded-full border border-border-gray"
                                style={{ backgroundColor: option.value }}
                                aria-hidden
                              />
                              {option.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[12px] leading-relaxed text-soft-black/50">
                  Exports at 1280×720. The preview updates instantly as you
                  change the headline, layout, and colors.
                </p>
              </div>
            )}
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
            {activeTab === "thumbnail" && (
              <button
                type="button"
                onClick={() => void handleSaveThumbnail()}
                disabled={isSavingThumbnail}
                aria-busy={isSavingThumbnail}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
                  focusRing
                )}
              >
                {isSavingThumbnail ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ImageIcon className="h-4 w-4" aria-hidden />
                )}
                {isSavingThumbnail ? "Saving thumbnail..." : "Save Thumbnail"}
              </button>
            )}
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
