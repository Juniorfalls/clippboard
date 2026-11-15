"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import Link from "next/link";
import { upload } from "@vercel/blob/client";
import * as Tabs from "@radix-ui/react-tabs";
import * as fabric from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Film,
  ImageIcon,
  ImagePlus,
  Italic,
  Layers,
  Loader2,
  Palette,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/CustomSelect";
import { getFfmpeg } from "@/lib/extract-audio";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;
const IMAGE_CLIP_SECONDS = 3;

const FONT_OPTIONS = [
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Impact, sans-serif", label: "Impact" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Arial Black', sans-serif", label: "Arial Black" },
];

const TEXT_COLORS = ["#FFFFFF", "#1C1C1C", "#3B82F6", "#FDE047", "#EF4444"];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const inputClass = cn(
  "block w-full rounded-2 border border-border-gray bg-white px-3.5 py-2.5 text-[14px] text-soft-black placeholder:text-soft-black/40 duration-200",
  focusRing
);

type MediaClip = {
  id: string;
  file: File;
  name: string;
  kind: "video" | "image";
  url: string;
  duration: number;
};

type TextSelection = {
  kind: "text";
  object: fabric.IText;
  text: string;
  fontFamily: string;
  fontSize: number;
  fill: string;
  bold: boolean;
  italic: boolean;
  align: "left" | "center" | "right";
  stroke: string;
  strokeWidth: number;
  shadow: boolean;
};

type OverlaySelection = TextSelection | { kind: "image" } | null;

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isTextObject(
  object: fabric.FabricObject | null
): object is fabric.IText {
  return Boolean(object && "text" in object && "fontSize" in object);
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function extensionFor(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "mp4";
}

export function VideoEditor({ userId }: { userId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [projectName, setProjectName] = useState("Untitled project");
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isDraggingMedia, setIsDraggingMedia] = useState(false);
  const [selection, setSelection] = useState<OverlaySelection>(null);
  const [isReady, setIsReady] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportedUrl, setExportedUrl] = useState<string | null>(null);

  const activeClip = useMemo(
    () => clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null,
    [clips, activeClipId]
  );

  const totalDuration = useMemo(
    () => clips.reduce((sum, clip) => sum + clip.duration, 0),
    [clips]
  );

  // ---------------------------------------------------------------- Canvas
  useEffect(() => {
    const element = canvasElementRef.current;
    if (!element) return;

    const canvas = new fabric.Canvas(element, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      preserveObjectStacking: true,
      selection: true,
      backgroundColor: undefined,
    });
    canvasRef.current = canvas;
    setIsReady(true);

    const sync = () => {
      const object = canvas.getActiveObject() ?? null;
      if (!object) {
        setSelection(null);
        return;
      }
      if (isTextObject(object)) {
        setSelection({
          kind: "text",
          object,
          text: object.text ?? "",
          fontFamily: String(object.fontFamily ?? "Inter, sans-serif"),
          fontSize: Math.round(Number(object.fontSize ?? 64)),
          fill: typeof object.fill === "string" ? object.fill : "#FFFFFF",
          bold: Number(object.fontWeight ?? 400) >= 600,
          italic: object.fontStyle === "italic",
          align: (object.textAlign as TextSelection["align"]) ?? "left",
          stroke:
            typeof object.stroke === "string" ? object.stroke : "#1C1C1C",
          strokeWidth: Number(object.strokeWidth ?? 0),
          shadow: Boolean(object.shadow),
        });
      } else {
        setSelection({ kind: "image" });
      }
    };

    canvas.on("selection:created", sync);
    canvas.on("selection:updated", sync);
    canvas.on("selection:cleared", sync);
    canvas.on("object:modified", sync);

    return () => {
      canvas.off("selection:created", sync);
      canvas.off("selection:updated", sync);
      canvas.off("selection:cleared", sync);
      canvas.off("object:modified", sync);
      void canvas.dispose();
      canvasRef.current = null;
      setIsReady(false);
    };
  }, []);

  // Revoke object URLs when clips are removed or the editor unmounts.
  useEffect(() => {
    return () => {
      clips.forEach((clip) => URL.revokeObjectURL(clip.url));
    };
    // Only run on unmount; individual removals revoke their own URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----------------------------------------------------------- Media upload
  const addMediaFiles = useCallback((files: File[]) => {
    const accepted = files.filter(
      (file) =>
        file.type.startsWith("video/") || file.type.startsWith("image/")
    );

    if (accepted.length === 0) {
      toast.error("Add video or image files", {
        description: "MP4, MOV, WebM, JPG, PNG or WebP.",
      });
      return;
    }

    const next: MediaClip[] = accepted.map((file) => ({
      id: createId(),
      file,
      name: file.name,
      kind: file.type.startsWith("video/") ? "video" : "image",
      url: URL.createObjectURL(file),
      duration: file.type.startsWith("image/") ? IMAGE_CLIP_SECONDS : 0,
    }));

    setClips((current) => [...current, ...next]);
    setActiveClipId((current) => current ?? next[0]?.id ?? null);

    next.forEach((clip) => {
      if (clip.kind !== "video") return;
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.muted = true;
      probe.src = clip.url;
      probe.onloadedmetadata = () => {
        const duration = Number.isFinite(probe.duration) ? probe.duration : 0;
        setClips((current) =>
          current.map((item) =>
            item.id === clip.id ? { ...item, duration } : item
          )
        );
      };
      probe.onerror = () => {
        toast.error("Could not read one of the videos", {
          description: clip.name,
        });
      };
    });

    toast.success(
      accepted.length === 1 ? "Media added" : `${accepted.length} media files added`,
      { description: "Arrange them on the timeline, then export." }
    );
  }, []);

  function handleMediaInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) addMediaFiles(files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDraggingMedia(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length) addMediaFiles(files);
  }

  function removeClip(id: string) {
    setClips((current) => {
      const target = current.find((clip) => clip.id === id);
      if (target) URL.revokeObjectURL(target.url);
      const remaining = current.filter((clip) => clip.id !== id);
      if (activeClipId === id) {
        setActiveClipId(remaining[0]?.id ?? null);
      }
      return remaining;
    });
  }

  function moveClip(id: string, direction: -1 | 1) {
    setClips((current) => {
      const index = current.findIndex((clip) => clip.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function selectClip(id: string) {
    setActiveClipId(id);
    setIsPlaying(false);
    const video = videoRef.current;
    if (video) video.currentTime = 0;
  }

  // -------------------------------------------------------------- Playback
  function togglePlayback() {
    const video = videoRef.current;
    if (!video || !activeClip) return;
    if (video.paused) {
      void video.play().then(() => setIsPlaying(true)).catch(() => {
        toast.error("This video cannot be played in the browser.");
      });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }

  function restartPlayback() {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = 0;
    void video.play().then(() => setIsPlaying(true)).catch(() => undefined);
  }

  const playNextClip = useCallback(() => {
    setClips((current) => current);
    const index = clips.findIndex((clip) => clip.id === activeClip?.id);
    const next = clips[index + 1];
    if (next) {
      setActiveClipId(next.id);
      setIsPlaying(false);
    } else {
      setIsPlaying(false);
    }
  }, [activeClip?.id, clips]);

  useEffect(() => {
    if (!activeClip) return;
    const video = videoRef.current;
    if (!video) return;
    video.load();
    setIsPlaying(false);
  }, [activeClip?.id]);

  useEffect(() => {
    if (activeClip?.kind !== "image") return;
    const timer = window.setTimeout(() => playNextClip(), IMAGE_CLIP_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [activeClip?.id, activeClip?.kind, playNextClip]);

  // ------------------------------------------------------------- Text tools
  function applyShadow(object: fabric.IText, enabled: boolean) {
    object.set(
      "shadow",
      enabled
        ? new fabric.Shadow({
            color: "rgba(0,0,0,0.55)",
            blur: 18,
            offsetX: 6,
            offsetY: 8,
          })
        : null
    );
  }

  function addTextLayer() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const layer = new fabric.IText("YOUR HEADLINE", {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      originX: "center",
      originY: "center",
      fontFamily: "Arial Black, sans-serif",
      fontSize: 96,
      fill: "#FFFFFF",
      fontWeight: "bold",
      lineHeight: 1.05,
      textAlign: "left",
      shadow: new fabric.Shadow({
        color: "rgba(0,0,0,0.45)",
        blur: 16,
        offsetX: 5,
        offsetY: 6,
      }),
    });

    canvas.add(layer);
    canvas.setActiveObject(layer);
    canvas.requestRenderAll();
  }

  async function addLogoLayer(file: File) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Could not read that image."));
        reader.readAsDataURL(file);
      });

      const image = await fabric.Image.fromURL(dataUrl);
      const maxSize = CANVAS_WIDTH * 0.22;
      const scale = Math.min(
        maxSize / (image.width ?? maxSize),
        maxSize / (image.height ?? maxSize),
        1
      );
      image.set({
        left: CANVAS_WIDTH - (image.width ?? 0) * scale - 48,
        top: 48,
        scaleX: scale,
        scaleY: scale,
      });

      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
    } catch (error) {
      toast.error("Could not add that logo", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  }

  function updateSelectedText(update: Partial<TextSelection>) {
    const canvas = canvasRef.current;
    const active =
      selection?.kind === "text"
        ? selection.object
        : canvas?.getActiveObject() ?? null;
    if (!isTextObject(active)) return;

    const next = {
      text:
        update.text ??
        (selection?.kind === "text" ? selection.text : active.text) ??
        "",
      fontFamily:
        update.fontFamily ??
        (selection?.kind === "text"
          ? selection.fontFamily
          : String(active.fontFamily ?? "Arial")),
      fontSize:
        update.fontSize ??
        (selection?.kind === "text"
          ? selection.fontSize
          : Math.round(Number(active.fontSize ?? 64))),
      fill:
        update.fill ??
        (selection?.kind === "text"
          ? selection.fill
          : typeof active.fill === "string"
            ? active.fill
            : "#FFFFFF"),
      bold:
        update.bold ??
        (selection?.kind === "text"
          ? selection.bold
          : Number(active.fontWeight ?? 400) >= 600),
      italic:
        update.italic ??
        (selection?.kind === "text"
          ? selection.italic
          : active.fontStyle === "italic"),
      align:
        update.align ??
        (selection?.kind === "text"
          ? selection.align
          : ((active.textAlign as TextSelection["align"]) ?? "left")),
      stroke:
        update.stroke ??
        (selection?.kind === "text"
          ? selection.stroke
          : typeof active.stroke === "string"
            ? active.stroke
            : "#1C1C1C"),
      strokeWidth:
        update.strokeWidth ??
        (selection?.kind === "text"
          ? selection.strokeWidth
          : Number(active.strokeWidth ?? 0)),
      shadow:
        update.shadow ??
        (selection?.kind === "text" ? selection.shadow : Boolean(active.shadow)),
    };

    active.set({
      text: next.text,
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      fill: next.fill,
      fontWeight: next.bold ? "bold" : "normal",
      fontStyle: next.italic ? "italic" : "normal",
      textAlign: next.align,
      stroke: next.stroke,
      strokeWidth: next.strokeWidth,
    });
    applyShadow(active, next.shadow);
    active.canvas?.requestRenderAll();
    setSelection({ kind: "text", object: active, ...next });
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() ?? null;
    if (!canvas || !active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelection(null);
  }

  function exportOverlayPng() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    if (canvas.getObjects().length === 0) return null;
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    return canvas.toDataURL({ format: "png", multiplier: 1 });
  }

  // ---------------------------------------------------------------- Export
  async function handleExport() {
    if (clips.length === 0) {
      toast.error("Add media before exporting", {
        description: "Drop at least one video or image onto the timeline.",
      });
      return;
    }
    if (isExporting) return;

    setIsExporting(true);
    setExportProgress(0);
    setExportedUrl(null);

    const runId = Date.now();
    const writtenFiles: string[] = [];
    let ffmpeg: Awaited<ReturnType<typeof getFfmpeg>> | null = null;
    const onProgress = ({ progress }: { progress: number }) => {
      if (Number.isFinite(progress)) {
        setExportProgress(Math.min(95, Math.max(1, Math.round(progress * 100))));
      }
    };

    try {
      const { fetchFile } = await import("@ffmpeg/util");
      ffmpeg = await getFfmpeg();
      ffmpeg.on("progress", onProgress);

      const concatEntries: string[] = [];

      for (let index = 0; index < clips.length; index += 1) {
        const clip = clips[index];
        const base = `editor-${runId}-${index}`;

        if (clip.kind === "image") {
          const sourceName = `${base}.${extensionFor(clip.file)}`;
          const outputName = `${base}.mp4`;
          await ffmpeg.writeFile(sourceName, await fetchFile(clip.file));
          writtenFiles.push(sourceName);
          const code = await ffmpeg.exec([
            "-loop",
            "1",
            "-t",
            String(IMAGE_CLIP_SECONDS),
            "-i",
            sourceName,
            "-vf",
            "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,format=yuv420p",
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            outputName,
          ]);
          if (code !== 0) {
            throw new Error(`Could not prepare image clip "${clip.name}".`);
          }
          writtenFiles.push(outputName);
          concatEntries.push(`file '${outputName}'`);
        } else {
          const inputName = `${base}.${extensionFor(clip.file)}`;
          await ffmpeg.writeFile(inputName, await fetchFile(clip.file));
          writtenFiles.push(inputName);
          concatEntries.push(`file '${inputName}'`);
        }
      }

      const concatName = `concat-${runId}.txt`;
      await ffmpeg.writeFile(concatName, concatEntries.join("\n"));
      writtenFiles.push(concatName);

      const stitchedName = `stitched-${runId}.mp4`;
      const concatArgs = [
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatName,
      ];

      let code = await ffmpeg.exec([
        ...concatArgs,
        "-c",
        "copy",
        stitchedName,
      ]);

      if (code !== 0) {
        code = await ffmpeg.exec([
          ...concatArgs,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "aac",
          stitchedName,
        ]);
      }

      if (code !== 0) {
        code = await ffmpeg.exec([
          ...concatArgs,
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-pix_fmt",
          "yuv420p",
          "-an",
          stitchedName,
        ]);
      }

      if (code !== 0) {
        throw new Error("FFmpeg could not stitch these clips together.");
      }
      writtenFiles.push(stitchedName);

      let finalName = stitchedName;
      const overlayDataUrl = exportOverlayPng();

      if (overlayDataUrl) {
        const overlayBlob = await (await fetch(overlayDataUrl)).blob();
        const overlayName = `overlay-${runId}.png`;
        await ffmpeg.writeFile(
          overlayName,
          new Uint8Array(await overlayBlob.arrayBuffer())
        );
        writtenFiles.push(overlayName);

        const finalOutput = `final-${runId}.mp4`;
        code = await ffmpeg.exec([
          "-i",
          stitchedName,
          "-i",
          overlayName,
          "-filter_complex",
          "[1:v][0:v]scale2ref[ov][base];[base][ov]overlay=0:0",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-pix_fmt",
          "yuv420p",
          "-c:a",
          "copy",
          finalOutput,
        ]);

        if (code !== 0) {
          code = await ffmpeg.exec([
            "-i",
            stitchedName,
            "-i",
            overlayName,
            "-filter_complex",
            "[0:v][1:v]overlay=0:0",
            "-c:v",
            "libx264",
            "-preset",
            "ultrafast",
            "-pix_fmt",
            "yuv420p",
            "-an",
            finalOutput,
          ]);
        }

        if (code !== 0) {
          throw new Error("FFmpeg could not apply the text and logo overlay.");
        }
        writtenFiles.push(finalOutput);
        finalName = finalOutput;
      }

      setExportProgress(96);
      const data = await ffmpeg.readFile(finalName);
      const videoBytes =
        typeof data === "string" ? new TextEncoder().encode(data) : data;
      if (videoBytes.byteLength === 0) {
        throw new Error("The exported video is empty.");
      }

      const outputBlob = new Blob([videoBytes as BlobPart], {
        type: "video/mp4",
      });
      const projectSlug =
        projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") ||
        "editor-project";
      const file = new File(
        [outputBlob],
        `${projectSlug}-${runId}.mp4`,
        { type: "video/mp4" }
      );

      const uploaded = await upload(
        `editor/${userId}/${projectSlug}-${runId}.mp4`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: "video/mp4",
          clientPayload: JSON.stringify({ userId }),
        }
      );

      if (!uploaded.url?.startsWith("https://")) {
        throw new Error("The export upload did not return a public URL.");
      }

      const duration = clips.reduce(
        (sum, clip) => sum + (clip.duration || IMAGE_CLIP_SECONDS),
        0
      );
      const title = projectName.trim() || "Untitled project";

      const supabase = createClient();
      const metadata = {
        id: createId(),
        title,
        duration,
        engagementScore: 0,
        startTime: 0,
        endTime: duration,
        hookText: "",
        viralityReason: "Created in the standalone video editor",
        status: "completed",
        url: uploaded.url,
        storageUrl: uploaded.url,
        createdIn: "standalone-editor",
      };

      const { error: insertError } = await supabase.from("clips").insert({
        user_id: userId,
        title,
        duration,
        engagement_score: 0,
        start_time: 0,
        end_time: duration,
        hook_text: "",
        virality_reason: "Created in the standalone video editor",
        video_url: uploaded.url,
        status: "completed",
        metadata,
        updated_at: new Date().toISOString(),
      });

      if (insertError) throw insertError;

      setExportedUrl(uploaded.url);
      setExportProgress(100);
      toast.success("Video exported!", {
        description: "Saved to your Workspace clips.",
      });
    } catch (error) {
      console.error("[editor] Export failed", error);
      toast.error("Export failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      if (ffmpeg) {
        ffmpeg.off("progress", onProgress);
        await Promise.allSettled(
          writtenFiles.map((name) => ffmpeg!.deleteFile(name))
        );
      }
      setIsExporting(false);
    }
  }

  // ------------------------------------------------------------------- UI
  const textSelection = selection?.kind === "text" ? selection : null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-warm-white text-soft-black">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border-gray bg-white px-4 py-3">
        <Link
          href="/dashboard"
          aria-label="Back to workspace"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-gray text-soft-black/70 duration-200 hover:bg-warm-white hover:text-soft-black",
            focusRing
          )}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </Link>

        <div className="min-w-0 flex-1">
          <label htmlFor="project-name" className="sr-only">
            Project name
          </label>
          <input
            id="project-name"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Untitled project"
            className={cn(
              "w-full max-w-md rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-[20px] font-bold leading-[1.25] text-soft-black duration-200 hover:border-border-gray focus:border-brand-blue focus:bg-white",
              focusRing
            )}
          />
          <p className="px-2 text-[12px] font-semibold text-soft-black/40">
            Browser-based processing · Keep tab open during export
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-border-gray bg-warm-white px-3 py-1.5 text-[12px] font-semibold text-soft-black/60 sm:inline-flex">
            <Film className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
            {clips.length} clip{clips.length === 1 ? "" : "s"} ·{" "}
            {formatDuration(totalDuration)}
          </span>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={isExporting || clips.length === 0}
            aria-busy={isExporting}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60 xs:rounded-3",
              focusRing
            )}
          >
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Download className="h-4 w-4" aria-hidden />
            )}
            {isExporting ? `Exporting ${exportProgress}%` : "Export Video"}
          </button>
        </div>
      </header>

      {isExporting && (
        <div className="h-1 w-full bg-brand-blue-light" role="progressbar" aria-valuenow={exportProgress} aria-valuemin={0} aria-valuemax={100}>
          <div
            className="h-full bg-brand-blue transition-[width] duration-300"
            style={{ width: `${exportProgress}%` }}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <section
            aria-label="Video preview"
            className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 bg-soft-black p-3 sm:p-5"
          >
            <div className="relative aspect-video w-full max-w-4xl overflow-hidden rounded-2 border-2 border-white/10 bg-black shadow-2xl">
              {activeClip?.kind === "video" ? (
                <video
                  key={activeClip.id}
                  ref={videoRef}
                  src={activeClip.url}
                  playsInline
                  onEnded={playNextClip}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  className="h-full w-full object-contain"
                />
              ) : activeClip?.kind === "image" ? (
                <img
                  src={activeClip.url}
                  alt={activeClip.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-warm-white/60">
                  <Film className="h-10 w-10 text-brand-blue" aria-hidden />
                  <p className="text-[16px] font-semibold text-warm-white">
                    Your timeline is empty
                  </p>
                  <p className="text-[13px]">
                    Add videos and images below to start editing.
                  </p>
                </div>
              )}

              <div
                className="editor-overlay absolute inset-0 z-10"
                aria-label="Text and logo overlay canvas"
              >
                <canvas ref={canvasElementRef} />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                disabled={!activeClip || activeClip.kind === "image"}
                aria-label={isPlaying ? "Pause preview" : "Play preview"}
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full bg-warm-white text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-40",
                  focusRing
                )}
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4" aria-hidden />
                ) : (
                  <Play className="h-4 w-4" aria-hidden />
                )}
              </button>
              <button
                type="button"
                onClick={restartPlayback}
                disabled={!activeClip || activeClip.kind === "image"}
                aria-label="Restart preview"
                className={cn(
                  "inline-flex h-10 w-10 items-center justify-center rounded-full bg-warm-white/10 text-warm-white duration-200 hover:bg-warm-white/20 disabled:cursor-not-allowed disabled:opacity-40",
                  focusRing
                )}
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
              </button>
              <span className="ml-1 max-w-[240px] truncate text-[12px] font-semibold text-warm-white/60">
                {activeClip ? activeClip.name : "No clip selected"}
              </span>
              {exportedUrl && (
                <a
                  href={exportedUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    "ml-2 inline-flex items-center gap-1.5 rounded-lg border border-brand-blue/40 bg-brand-blue/15 px-3 py-2 text-[12px] font-semibold text-brand-blue-hover duration-200 hover:bg-brand-blue/25",
                    focusRing
                  )}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden />
                  Open export
                </a>
              )}
            </div>
          </section>

          <section
            aria-label="Timeline"
            className="shrink-0 border-t border-border-gray bg-white px-3 py-3 sm:px-5"
          >
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[14px] font-bold leading-[1.25]">
                  Timeline
                </h2>
                <p className="text-[12px] text-soft-black/50">
                  Clips play left to right. Images hold for {IMAGE_CLIP_SECONDS}s.
                </p>
              </div>
              <button
                type="button"
                onClick={() => mediaInputRef.current?.click()}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-2 border border-border-gray bg-warm-white px-3 py-2 text-[12px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-light",
                  focusRing
                )}
              >
                <Plus className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
                Add media
              </button>
              <input
                ref={mediaInputRef}
                type="file"
                accept="video/mp4,video/quicktime,video/webm,image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={handleMediaInput}
              />
            </div>

            <div
              onDragOver={(event) => {
                event.preventDefault();
                setIsDraggingMedia(true);
              }}
              onDragLeave={() => setIsDraggingMedia(false)}
              onDrop={handleDrop}
              className={cn(
                "no-scrollbar flex min-h-[92px] items-stretch gap-2 overflow-x-auto rounded-2 border-2 border-dashed p-2 duration-200",
                isDraggingMedia
                  ? "border-brand-blue bg-brand-blue/10"
                  : "border-border-gray bg-warm-white"
              )}
            >
              {clips.length === 0 ? (
                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className={cn(
                    "flex min-h-[72px] w-full flex-col items-center justify-center gap-1 rounded-lg px-4 py-3 text-center",
                    focusRing
                  )}
                >
                  <UploadCloud className="h-5 w-5 text-brand-blue" aria-hidden />
                  <span className="text-[13px] font-semibold">
                    Drag &amp; drop videos or images, or click to browse
                  </span>
                  <span className="text-[11px] text-soft-black/50">
                    MP4, MOV, WebM, PNG, JPG or WebP
                  </span>
                </button>
              ) : (
                clips.map((clip, index) => {
                  const active = clip.id === activeClip?.id;
                  return (
                    <div
                      key={clip.id}
                      className={cn(
                        "flex w-[170px] shrink-0 flex-col overflow-hidden rounded-lg border-2 bg-white",
                        active
                          ? "border-brand-blue shadow-sm"
                          : "border-border-gray"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectClip(clip.id)}
                        aria-pressed={active}
                        aria-label={`Preview ${clip.name}`}
                        className={cn("relative block h-[54px] w-full overflow-hidden bg-soft-black", focusRing)}
                      >
                        {clip.kind === "video" ? (
                          <video
                            src={clip.url}
                            muted
                            preload="metadata"
                            className="h-full w-full object-cover opacity-90"
                          />
                        ) : (
                          <img
                            src={clip.url}
                            alt=""
                            className="h-full w-full object-cover opacity-90"
                          />
                        )}
                        <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded bg-soft-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-warm-white">
                          {clip.kind === "video" ? (
                            <Film className="h-2.5 w-2.5" aria-hidden />
                          ) : (
                            <ImageIcon className="h-2.5 w-2.5" aria-hidden />
                          )}
                          {index + 1}
                        </span>
                        <span className="absolute bottom-1 right-1 rounded bg-soft-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-warm-white">
                          {formatDuration(clip.duration || IMAGE_CLIP_SECONDS)}
                        </span>
                      </button>
                      <div className="flex items-center gap-1 px-1.5 py-1">
                        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-soft-black/70">
                          {clip.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => moveClip(clip.id, -1)}
                          disabled={index === 0}
                          aria-label={`Move ${clip.name} left`}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded text-soft-black/60 duration-200 hover:bg-warm-white disabled:opacity-30",
                            focusRing
                          )}
                        >
                          <ChevronLeft className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveClip(clip.id, 1)}
                          disabled={index === clips.length - 1}
                          aria-label={`Move ${clip.name} right`}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded text-soft-black/60 duration-200 hover:bg-warm-white disabled:opacity-30",
                            focusRing
                          )}
                        >
                          <ChevronRight className="h-3 w-3" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeClip(clip.id)}
                          aria-label={`Remove ${clip.name}`}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded text-red-600 duration-200 hover:bg-red-50",
                            focusRing
                          )}
                        >
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>

        <aside
          aria-label="Overlay properties"
          className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-border-gray bg-warm-white p-4 lg:w-[360px] lg:border-l lg:border-t-0"
        >
          <Tabs.Root defaultValue="text" className="flex flex-col gap-3">
            <Tabs.List
              aria-label="Overlay properties"
              className="grid grid-cols-3 gap-1 rounded-lg border border-border-gray bg-white p-1"
            >
              {[
                { value: "text", label: "Text", icon: Type },
                { value: "logo", label: "Logo", icon: ImagePlus },
                { value: "colors", label: "Colors", icon: Palette },
              ].map(({ value, label, icon: Icon }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-md px-2 py-2 text-[12px] font-semibold text-soft-black/60 duration-200 hover:bg-warm-white data-[state=active]:bg-brand-blue-light data-[state=active]:text-soft-black",
                    focusRing
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="text" className="flex flex-col gap-3">
              <button
                type="button"
                onClick={addTextLayer}
                disabled={!isReady}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-2 bg-brand-blue px-4 py-2.5 text-[13px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:opacity-60",
                  focusRing
                )}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Add text layer
              </button>

              {textSelection ? (
                <div className="flex flex-col gap-3 rounded-2 border border-border-gray bg-white p-3">
                  <div className="flex flex-col gap-1.5">
                    <label
                      htmlFor="overlay-text"
                      className="text-[13px] font-semibold text-soft-black"
                    >
                      Text
                    </label>
                    <textarea
                      id="overlay-text"
                      rows={2}
                      value={textSelection.text}
                      onChange={(event) =>
                        updateSelectedText({ text: event.target.value })
                      }
                      className={cn(inputClass, "resize-none leading-relaxed")}
                    />
                  </div>

                  <CustomSelect
                    label="Font"
                    value={textSelection.fontFamily}
                    onValueChange={(value) =>
                      updateSelectedText({ fontFamily: value })
                    }
                    options={FONT_OPTIONS}
                  />

                  <div className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold">Font size</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min={24}
                        max={200}
                        step={2}
                        value={textSelection.fontSize}
                        onChange={(event) =>
                          updateSelectedText({
                            fontSize: Number(event.target.value),
                          })
                        }
                        aria-label="Font size"
                        className={cn("h-1.5 w-full cursor-pointer accent-brand-blue", focusRing)}
                      />
                      <span className="w-10 text-right text-[12px] font-semibold text-soft-black/60">
                        {textSelection.fontSize}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      aria-pressed={textSelection.bold}
                      aria-label="Bold"
                      onClick={() =>
                        updateSelectedText({ bold: !textSelection.bold })
                      }
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border duration-200",
                        textSelection.bold
                          ? "border-brand-blue bg-brand-blue-light"
                          : "border-border-gray bg-white hover:bg-warm-white",
                        focusRing
                      )}
                    >
                      <Bold className="h-4 w-4" aria-hidden />
                    </button>
                    <button
                      type="button"
                      aria-pressed={textSelection.italic}
                      aria-label="Italic"
                      onClick={() =>
                        updateSelectedText({ italic: !textSelection.italic })
                      }
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-lg border duration-200",
                        textSelection.italic
                          ? "border-brand-blue bg-brand-blue-light"
                          : "border-border-gray bg-white hover:bg-warm-white",
                        focusRing
                      )}
                    >
                      <Italic className="h-4 w-4" aria-hidden />
                    </button>
                    {(
                      [
                        ["left", AlignLeft],
                        ["center", AlignCenter],
                        ["right", AlignRight],
                      ] as const
                    ).map(([align, Icon]) => (
                      <button
                        key={align}
                        type="button"
                        aria-pressed={textSelection.align === align}
                        aria-label={`Align ${align}`}
                        onClick={() => updateSelectedText({ align })}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-lg border duration-200",
                          textSelection.align === align
                            ? "border-brand-blue bg-brand-blue-light"
                            : "border-border-gray bg-white hover:bg-warm-white",
                          focusRing
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden />
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={deleteSelected}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-600 duration-200 hover:bg-red-50",
                      focusRing
                    )}
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete text layer
                  </button>
                </div>
              ) : (
                <div className="rounded-2 border border-dashed border-border-gray bg-white p-3 text-[12px] leading-relaxed text-soft-black/55">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-soft-black">
                    <Layers className="h-4 w-4 text-brand-blue" aria-hidden />
                    No text selected
                  </span>
                  <p className="mt-1">
                    Add a text layer, then drag it anywhere over the video
                    preview.
                  </p>
                </div>
              )}
            </Tabs.Content>

            <Tabs.Content value="logo" className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => logoInputRef.current?.click()}
                disabled={!isReady}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-2 border border-border-gray bg-white px-4 py-2.5 text-[13px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-light disabled:opacity-60",
                  focusRing
                )}
              >
                <ImagePlus className="h-4 w-4 text-brand-blue" aria-hidden />
                Add logo or image
              </button>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void addLogoLayer(file);
                }}
              />

              <div className="rounded-2 border border-border-gray bg-white p-3 text-[12px] leading-relaxed text-soft-black/60">
                Logos are added as resizable image layers on the transparent
                overlay. Drag the corner handles to size them.
              </div>

              {selection?.kind === "image" && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-600 duration-200 hover:bg-red-50",
                    focusRing
                  )}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete selected logo
                </button>
              )}
            </Tabs.Content>

            <Tabs.Content value="colors" className="flex flex-col gap-3">
              {textSelection ? (
                <>
                  <div className="rounded-2 border border-border-gray bg-white p-3">
                    <p className="mb-2 text-[13px] font-semibold">Text color</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {TEXT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-pressed={textSelection.fill === color}
                          aria-label={`Text color ${color}`}
                          onClick={() => updateSelectedText({ fill: color })}
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border-2 duration-200",
                            textSelection.fill === color
                              ? "border-brand-blue ring-2 ring-brand-blue-light"
                              : "border-border-gray",
                            focusRing
                          )}
                          style={{ backgroundColor: color }}
                        >
                          {textSelection.fill === color && (
                            <Check
                              className={cn(
                                "h-4 w-4",
                                color === "#FFFFFF" || color === "#FDE047"
                                  ? "text-soft-black"
                                  : "text-white"
                              )}
                              aria-hidden
                            />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2 border border-border-gray bg-white p-3">
                    <p className="mb-2 text-[13px] font-semibold">Outline</p>
                    <div className="flex flex-wrap items-center gap-2">
                      {["#1C1C1C", "#FFFFFF", "#3B82F6"].map((color) => (
                        <button
                          key={color}
                          type="button"
                          aria-pressed={textSelection.stroke === color}
                          aria-label={`Outline ${color}`}
                          onClick={() =>
                            updateSelectedText({
                              stroke: color,
                              strokeWidth: textSelection.strokeWidth || 4,
                            })
                          }
                          className={cn(
                            "h-8 w-8 rounded-full border-2 duration-200",
                            textSelection.stroke === color
                              ? "border-brand-blue ring-2 ring-brand-blue-light"
                              : "border-border-gray",
                            focusRing
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedText({
                            strokeWidth: textSelection.strokeWidth ? 0 : 4,
                          })
                        }
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold duration-200",
                          textSelection.strokeWidth
                            ? "border-brand-blue bg-brand-blue-light text-soft-black"
                            : "border-border-gray bg-white text-soft-black/70",
                          focusRing
                        )}
                      >
                        {textSelection.strokeWidth ? "On" : "Off"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-pressed={textSelection.shadow}
                    onClick={() =>
                      updateSelectedText({ shadow: !textSelection.shadow })
                    }
                    className={cn(
                      "w-full rounded-lg border px-3 py-2 text-[12px] font-semibold duration-200",
                      textSelection.shadow
                        ? "border-brand-blue bg-brand-blue-light text-soft-black"
                        : "border-border-gray bg-white text-soft-black/70 hover:bg-warm-white",
                      focusRing
                    )}
                  >
                    Drop shadow {textSelection.shadow ? "on" : "off"}
                  </button>
                </>
              ) : (
                <div className="rounded-2 border border-dashed border-border-gray bg-white p-3 text-[12px] leading-relaxed text-soft-black/55">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-soft-black">
                    <Palette className="h-4 w-4 text-brand-blue" aria-hidden />
                    Select a text layer
                  </span>
                  <p className="mt-1">
                    Pick a text layer on the preview to change its color,
                    outline and shadow.
                  </p>
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </aside>
      </div>
    </div>
  );
}
