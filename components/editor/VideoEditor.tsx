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
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tabs from "@radix-ui/react-tabs";
import * as fabric from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Bold,
  Download,
  Film,
  GripVertical,
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
  SlidersHorizontal,
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

const TEXT_PRESETS = [
  {
    id: "headline",
    label: "Headline",
    hint: "72px impact",
    fontSize: 72,
    fontWeight: "bold" as const,
    fontFamily: "Impact, sans-serif",
    text: "YOUR HEADLINE",
  },
  {
    id: "subtitle",
    label: "Subtitle",
    hint: "36px medium",
    fontSize: 36,
    fontWeight: "600" as const,
    fontFamily: "Inter, sans-serif",
    text: "Your subtitle text",
  },
  {
    id: "caption",
    label: "Caption",
    hint: "24px regular",
    fontSize: 24,
    fontWeight: "normal" as const,
    fontFamily: "Inter, sans-serif",
    text: "Your caption text",
  },
];

type TextPresetId = (typeof TEXT_PRESETS)[number]["id"];

type ColorGrade = {
  exposure: number;
  contrast: number;
  saturation: number;
  temperature: number;
};

const NO_GRADE: ColorGrade = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
};

const FILTER_PRESETS: {
  id: string;
  label: string;
  grade: ColorGrade;
  swatch: string;
}[] = [
  {
    id: "original",
    label: "Original",
    grade: NO_GRADE,
    swatch: "linear-gradient(135deg,#e5e7eb,#9ca3af)",
  },
  {
    id: "cinematic",
    label: "Cinematic",
    grade: { exposure: -4, contrast: 18, saturation: -8, temperature: -12 },
    swatch: "linear-gradient(135deg,#1e3a8a,#0f172a)",
  },
  {
    id: "vintage",
    label: "Vintage",
    grade: { exposure: 6, contrast: -8, saturation: -24, temperature: 30 },
    swatch: "linear-gradient(135deg,#d6b98c,#8b5e3c)",
  },
  {
    id: "bw",
    label: "B & W",
    grade: { exposure: 2, contrast: 12, saturation: -100, temperature: 0 },
    swatch: "linear-gradient(135deg,#f9fafb,#1c1c1c)",
  },
  {
    id: "warm",
    label: "Warm",
    grade: { exposure: 5, contrast: 4, saturation: 12, temperature: 34 },
    swatch: "linear-gradient(135deg,#fbbf24,#ef4444)",
  },
];

const RESOLUTIONS = [
  { value: "1080p", label: "1080p · 1920×1080" },
  { value: "4K", label: "4K · 3840×2160" },
];

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
  shadowX: number;
  shadowY: number;
  shadowBlur: number;
  shadowColor: string;
};

type OverlaySelection = TextSelection | { kind: "image" } | null;

type EditorLayer = {
  id: string;
  label: string;
  kind: "video" | "text" | "image";
  object: fabric.FabricObject | null;
};

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

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  const full =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized.padEnd(6, "0").slice(0, 6);
  const value = Number.parseInt(full, 16);
  if (Number.isNaN(value)) return { r: 255, g: 255, b: 255 };
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map((channel) => Math.max(0, Math.min(255, channel)))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function gradeToCssFilter(grade: ColorGrade) {
  const brightness = 1 + grade.exposure / 100;
  const contrast = 1 + grade.contrast / 100;
  const saturation = Math.max(0, 1 + grade.saturation / 100);
  const warm = Math.max(grade.temperature, 0) / 100;
  const cool = Math.max(-grade.temperature, 0) / 100;
  return [
    `brightness(${brightness.toFixed(2)})`,
    `contrast(${contrast.toFixed(2)})`,
    `saturate(${saturation.toFixed(2)})`,
    `sepia(${(warm * 0.38).toFixed(2)})`,
    `hue-rotate(${(-cool * 12).toFixed(1)}deg)`,
  ].join(" ");
}

function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const rgb = hexToRgb(value);
  const updateChannel = (channel: "r" | "g" | "b", next: number) => {
    onChange(
      rgbToHex(
        channel === "r" ? next : rgb.r,
        channel === "g" ? next : rgb.g,
        channel === "b" ? next : rgb.b
      )
    );
  };

  return (
    <div className="flex flex-col gap-2 rounded-2 border border-border-gray bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-soft-black">{label}</span>
        <span
          className="h-6 w-10 rounded-md border border-border-gray"
          style={{ backgroundColor: value }}
          aria-hidden
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {TEXT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${label} ${color}`}
            aria-pressed={value.toUpperCase() === color.toUpperCase()}
            onClick={() => onChange(color)}
            className={cn(
              "h-6 rounded-md border duration-200",
              value.toUpperCase() === color.toUpperCase()
                ? "border-brand-blue ring-2 ring-brand-blue-light"
                : "border-border-gray hover:border-brand-blue",
              focusRing
            )}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      {(["r", "g", "b"] as const).map((channel) => (
        <label key={channel} className="flex items-center gap-2 text-[11px] font-semibold uppercase text-soft-black/50">
          <span className="w-3">{channel}</span>
          <input
            type="range"
            min={0}
            max={255}
            value={rgb[channel]}
            onChange={(event) =>
              updateChannel(channel, Number(event.target.value))
            }
            aria-label={`${label} ${channel} channel`}
            className={cn("h-1.5 w-full cursor-pointer accent-brand-blue", focusRing)}
          />
          <span className="w-7 text-right tabular-nums text-soft-black/60">
            {rgb[channel]}
          </span>
        </label>
      ))}
      <input
        type="text"
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          if (/^#?[0-9a-fA-F]{0,6}$/.test(next)) {
            onChange(next.startsWith("#") ? next.toUpperCase() : `#${next.toUpperCase()}`);
          }
        }}
        aria-label={`${label} hex value`}
        spellCheck={false}
        className={cn(inputClass, "uppercase")}
      />
    </div>
  );
}

function SortableTimelineClip({
  clip,
  index,
  active,
  onSelect,
  onRemove,
}: {
  clip: MediaClip;
  index: number;
  active: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: clip.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.55 : 1,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        "flex w-[170px] shrink-0 flex-col overflow-hidden rounded-lg border-2 bg-white",
        active ? "border-brand-blue shadow-sm" : "border-border-gray",
        isDragging && "shadow-xl"
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => onSelect(clip.id)}
        aria-pressed={active}
        aria-label={`Preview or drag ${clip.name}`}
        className={cn(
          "relative block h-[54px] w-full cursor-grab overflow-hidden bg-soft-black active:cursor-grabbing",
          focusRing
        )}
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
        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded bg-soft-black/75 text-warm-white">
          <GripVertical className="h-3 w-3" aria-hidden />
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
          onClick={() => onRemove(clip.id)}
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
}

export function VideoEditor({ userId }: { userId: string }) {
  const router = useRouter();
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
  const [textPreset, setTextPreset] = useState<TextPresetId>("headline");
  const [colorGrade, setColorGrade] = useState<ColorGrade>(NO_GRADE);
  const [activeFilter, setActiveFilter] = useState("original");
  const [resolution, setResolution] = useState<"1080p" | "4K">("1080p");
  const [overlayLayers, setOverlayLayers] = useState<EditorLayer[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const autoplayNextRef = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const markDirty = useCallback(() => setHasUnsavedChanges(true), []);

  useEffect(() => {
    if (!hasUnsavedChanges) return;

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  function handleBack() {
    if (hasUnsavedChanges) {
      setLeaveDialogOpen(true);
      return;
    }
    router.push("/dashboard");
  }

  const refreshLayers = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      setOverlayLayers([]);
      return;
    }

    const next = canvas.getObjects().map((object, index) => {
      const tagged = object as fabric.FabricObject & {
        layerId?: string;
        layerName?: string;
      };
      const text = isTextObject(object) ? object.text?.trim() : "";
      return {
        id: tagged.layerId ?? `layer-${index}`,
        label:
          text && text.length > 0
            ? text.slice(0, 28)
            : tagged.layerName ?? (isTextObject(object) ? "Text" : "Logo"),
        kind: isTextObject(object) ? "text" : "image",
        object,
      } as EditorLayer;
    });

    setOverlayLayers(next.reverse());
  }, []);

  const activeClip = useMemo(
    () => clips.find((clip) => clip.id === activeClipId) ?? clips[0] ?? null,
    [clips, activeClipId]
  );

  const layers = useMemo<EditorLayer[]>(() => {
    const videoLayer: EditorLayer = {
      id: "video-layer",
      label: activeClip?.name ?? "Video",
      kind: "video",
      object: null,
    };
    return [videoLayer, ...overlayLayers];
  }, [activeClip?.name, overlayLayers]);

  const cssFilter = useMemo(() => gradeToCssFilter(colorGrade), [colorGrade]);

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
          shadowX: Number(object.shadow?.offsetX ?? 6),
          shadowY: Number(object.shadow?.offsetY ?? 8),
          shadowBlur: Number(object.shadow?.blur ?? 18),
          shadowColor:
            typeof object.shadow?.color === "string" &&
            object.shadow.color.startsWith("#")
              ? object.shadow.color
              : "#1C1C1C",
        });
      } else {
        setSelection({ kind: "image" });
      }
    };

    const syncLayers = () => {
      refreshLayers();
      markDirty();
    };

    canvas.on("selection:created", sync);
    canvas.on("selection:updated", sync);
    canvas.on("selection:cleared", sync);
    canvas.on("object:modified", sync);
    canvas.on("object:added", syncLayers);
    canvas.on("object:removed", syncLayers);

    return () => {
      canvas.off("selection:created", sync);
      canvas.off("selection:updated", sync);
      canvas.off("selection:cleared", sync);
      canvas.off("object:modified", sync);
      canvas.off("object:added", syncLayers);
      canvas.off("object:removed", syncLayers);
      void canvas.dispose();
      canvasRef.current = null;
      setIsReady(false);
      setOverlayLayers([]);
    };
  }, [markDirty, refreshLayers]);

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
    markDirty();

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
  }, [markDirty]);

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
    markDirty();
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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setClips((current) => {
      const oldIndex = current.findIndex((clip) => clip.id === active.id);
      const newIndex = current.findIndex((clip) => clip.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    markDirty();
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
    const index = clips.findIndex((clip) => clip.id === activeClip?.id);
    const next = clips[index + 1];
    if (next) {
      autoplayNextRef.current = true;
      setActiveClipId(next.id);
    } else {
      setIsPlaying(false);
    }
  }, [activeClip?.id, clips]);

  useEffect(() => {
    if (!activeClip) return;
    const video = videoRef.current;
    if (!video) return;
    video.load();

    if (autoplayNextRef.current && activeClip.kind === "video") {
      autoplayNextRef.current = false;
      void video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
      return;
    }

    autoplayNextRef.current = false;
    setIsPlaying(false);
  }, [activeClip?.id, activeClip?.kind]);

  useEffect(() => {
    if (activeClip?.kind !== "image") return;
    const timer = window.setTimeout(() => playNextClip(), IMAGE_CLIP_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [activeClip?.id, activeClip?.kind, playNextClip]);

  // ------------------------------------------------------------- Text tools
  function applyShadow(
    object: fabric.IText,
    enabled: boolean,
    offsetX: number,
    offsetY: number,
    blur: number,
    color: string
  ) {
    object.set(
      "shadow",
      enabled
        ? new fabric.Shadow({
            color,
            blur,
            offsetX,
            offsetY,
          })
        : null
    );
  }

  function tagLayer(object: fabric.FabricObject, label: string) {
    const tagged = object as fabric.FabricObject & {
      layerId?: string;
      layerName?: string;
    };
    tagged.layerId = tagged.layerId ?? createId();
    tagged.layerName = label;
  }

  function applyTextPreset(id: TextPresetId) {
    setTextPreset(id);
    const preset = TEXT_PRESETS.find((item) => item.id === id);
    if (!preset) return;

    if (selection?.kind === "text") {
      updateSelectedText({
        fontSize: preset.fontSize,
        fontFamily: preset.fontFamily,
        bold: preset.fontWeight !== "normal",
      });
    }
  }

  function addTextLayer() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    markDirty();

    const preset = TEXT_PRESETS.find((item) => item.id === textPreset) ?? TEXT_PRESETS[0];
    const layer = new fabric.IText(preset.text, {
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      originX: "center",
      originY: "center",
      fontFamily: preset.fontFamily,
      fontSize: preset.fontSize,
      fill: "#FFFFFF",
      fontWeight: preset.fontWeight === "normal" ? "normal" : "bold",
      lineHeight: 1.15,
      textAlign: "center",
      stroke: "#1C1C1C",
      strokeWidth: preset.id === "headline" ? 3 : 0,
      shadow: new fabric.Shadow({
        color: "#1C1C1C",
        blur: 18,
        offsetX: 6,
        offsetY: 8,
      }),
    });
    tagLayer(layer, preset.label);

    canvas.add(layer);
    canvas.setActiveObject(layer);
    canvas.requestRenderAll();
  }

  async function addLogoLayer(file: File) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    markDirty();

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
      tagLayer(image, file.name.replace(/\.[^.]+$/, "").slice(0, 28) || "Logo");

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
      shadowX:
        update.shadowX ??
        (selection?.kind === "text"
          ? selection.shadowX
          : Number(active.shadow?.offsetX ?? 6)),
      shadowY:
        update.shadowY ??
        (selection?.kind === "text"
          ? selection.shadowY
          : Number(active.shadow?.offsetY ?? 8)),
      shadowBlur:
        update.shadowBlur ??
        (selection?.kind === "text"
          ? selection.shadowBlur
          : Number(active.shadow?.blur ?? 18)),
      shadowColor:
        update.shadowColor ??
        (selection?.kind === "text"
          ? selection.shadowColor
          : typeof active.shadow?.color === "string" &&
              active.shadow.color.startsWith("#")
            ? active.shadow.color
            : "#1C1C1C"),
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
    applyShadow(
      active,
      next.shadow,
      next.shadowX,
      next.shadowY,
      next.shadowBlur,
      next.shadowColor
    );
    active.canvas?.requestRenderAll();
    setSelection({ kind: "text", object: active, ...next });
    refreshLayers();
    markDirty();
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() ?? null;
    if (!canvas || !active) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelection(null);
    refreshLayers();
  }

  function selectLayer(layer: EditorLayer) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (layer.kind === "video" || !layer.object) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
      setSelection(null);
      return;
    }

    canvas.setActiveObject(layer.object);
    canvas.requestRenderAll();
  }

  function moveLayer(layer: EditorLayer, direction: "back" | "front") {
    const canvas = canvasRef.current;
    if (!canvas || !layer.object) return;
    markDirty();

    if (direction === "back") canvas.sendObjectToBack(layer.object);
    else canvas.bringObjectToFront(layer.object);
    canvas.requestRenderAll();
    refreshLayers();
  }

  function deleteLayer(layer: EditorLayer) {
    const canvas = canvasRef.current;
    if (!canvas || !layer.object) return;

    canvas.remove(layer.object);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelection(null);
    refreshLayers();
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
      let overlayName: string | null = null;

      if (overlayDataUrl) {
        const overlayBlob = await (await fetch(overlayDataUrl)).blob();
        overlayName = `overlay-${runId}.png`;
        await ffmpeg.writeFile(
          overlayName,
          new Uint8Array(await overlayBlob.arrayBuffer())
        );
        writtenFiles.push(overlayName);
      }

      const target =
        resolution === "4K"
          ? { width: 3840, height: 2160 }
          : { width: 1920, height: 1080 };
      const brightness = (colorGrade.exposure / 100).toFixed(3);
      const contrast = (1 + colorGrade.contrast / 100).toFixed(3);
      const saturation = Math.max(
        0,
        1 + colorGrade.saturation / 100
      ).toFixed(3);
      const warmth = ((colorGrade.temperature / 100) * 0.3).toFixed(3);
      const filterComplex = [
        `[0:v]eq=brightness=${brightness}:contrast=${contrast}:saturation=${saturation}` +
          `,colorbalance=rs=${warmth}:gs=${warmth === "0.000" ? "0.000" : (Number(warmth) * 0.2).toFixed(3)}:bs=${(-Number(warmth)).toFixed(3)}` +
          `,scale=${target.width}:${target.height}:force_original_aspect_ratio=decrease` +
          `,pad=${target.width}:${target.height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p[base]`,
        overlayName
          ? `[1:v][base]scale2ref[ov][scaled];[scaled][ov]overlay=0:0[out]`
          : `[base]null[out]`,
      ].join(";");

      const finalOutput = `final-${runId}.mp4`;
      const finalArgs = [
        "-i",
        stitchedName,
        ...(overlayName ? ["-i", overlayName] : []),
        "-filter_complex",
        filterComplex,
        "-map",
        "[out]",
        "-map",
        "0:a?",
        "-c:v",
        "libx264",
        "-preset",
        "veryfast",
        "-crf",
        "20",
        "-pix_fmt",
        "yuv420p",
        "-c:a",
        "copy",
        finalOutput,
      ];

      code = await ffmpeg.exec(finalArgs);

      if (code !== 0) {
        code = await ffmpeg.exec([
          "-i",
          stitchedName,
          ...(overlayName ? ["-i", overlayName] : []),
          "-filter_complex",
          filterComplex,
          "-map",
          "[out]",
          "-an",
          "-c:v",
          "libx264",
          "-preset",
          "ultrafast",
          "-pix_fmt",
          "yuv420p",
          finalOutput,
        ]);
      }

      if (code !== 0) {
        throw new Error(
          "FFmpeg could not apply the color grade and overlay to this video."
        );
      }
      writtenFiles.push(finalOutput);
      finalName = finalOutput;

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
      setHasUnsavedChanges(false);
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
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back to workspace"
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-gray text-soft-black/70 duration-200 hover:bg-warm-white hover:text-soft-black",
            focusRing
          )}
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
        </button>

        <div className="min-w-0 flex-1">
          <label htmlFor="project-name" className="sr-only">
            Project name
          </label>
          <input
            id="project-name"
            value={projectName}
            onChange={(event) => {
              setProjectName(event.target.value);
              markDirty();
            }}
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
                  style={{ filter: cssFilter }}
                  className="h-full w-full object-contain"
                />
              ) : activeClip?.kind === "image" ? (
                <img
                  src={activeClip.url}
                  alt={activeClip.name}
                  style={{ filter: cssFilter }}
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
                  Clips play left to right. Drag thumbnails to reorder. Images hold for {IMAGE_CLIP_SECONDS}s.
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

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={clips.map((clip) => clip.id)}
                strategy={horizontalListSortingStrategy}
              >
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
                    clips.map((clip, index) => (
                      <SortableTimelineClip
                        key={clip.id}
                        clip={clip}
                        index={index}
                        active={clip.id === activeClip?.id}
                        onSelect={selectClip}
                        onRemove={removeClip}
                      />
                    ))
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </section>
        </div>

        <aside
          aria-label="Overlay properties"
          className="flex w-full shrink-0 flex-col overflow-y-auto border-t border-border-gray bg-warm-white p-4 lg:w-[360px] lg:border-l lg:border-t-0"
        >
          <Tabs.Root defaultValue="text" className="flex flex-col gap-3">
            <Tabs.List
              aria-label="Overlay properties"
              className="grid grid-cols-4 gap-1 rounded-lg border border-border-gray bg-white p-1"
            >
              {[
                { value: "text", label: "Text", icon: Type },
                { value: "logo", label: "Logo", icon: ImagePlus },
                { value: "colors", label: "Color", icon: Palette },
                { value: "layers", label: "Layers", icon: Layers },
              ].map(({ value, label, icon: Icon }) => (
                <Tabs.Trigger
                  key={value}
                  value={value}
                  className={cn(
                    "inline-flex items-center justify-center gap-1.5 rounded-md px-1.5 py-2 text-[12px] font-semibold text-soft-black/60 duration-200 hover:bg-warm-white data-[state=active]:bg-brand-blue-light data-[state=active]:text-soft-black",
                    focusRing
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {label}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            <Tabs.Content value="text" className="flex flex-col gap-3">
              <div className="rounded-2 border border-border-gray bg-white p-2">
                <p className="mb-1.5 px-1 text-[12px] font-semibold text-soft-black/60">
                  Text preset
                </p>
                <div className="grid grid-cols-3 gap-1">
                  {TEXT_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={textPreset === preset.id}
                      onClick={() => applyTextPreset(preset.id)}
                      className={cn(
                        "flex flex-col items-center rounded-lg px-1.5 py-2 text-center duration-200",
                        textPreset === preset.id
                          ? "bg-brand-blue-light text-soft-black"
                          : "text-soft-black/60 hover:bg-warm-white",
                        focusRing
                      )}
                    >
                      <span className="text-[12px] font-semibold">{preset.label}</span>
                      <span className="text-[10px]">{preset.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

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
                Add {TEXT_PRESETS.find((item) => item.id === textPreset)?.label ?? "text"}
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

                  <div className="flex flex-col gap-2">
                    <span className="text-[13px] font-semibold">Font weight</span>
                    <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-gray bg-white p-1">
                      {[
                        { label: "Normal", value: false },
                        { label: "Bold", value: true },
                      ].map((option) => (
                        <button
                          key={option.label}
                          type="button"
                          aria-pressed={textSelection.bold === option.value}
                          onClick={() =>
                            updateSelectedText({ bold: option.value })
                          }
                          className={cn(
                            "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-[12px] font-semibold duration-200",
                            textSelection.bold === option.value
                              ? "bg-brand-blue-light text-soft-black"
                              : "text-soft-black/60 hover:bg-warm-white",
                            focusRing
                          )}
                        >
                          {option.value && <Bold className="h-3.5 w-3.5" aria-hidden />}
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
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

                  <ColorPicker
                    label="Text color"
                    value={textSelection.fill}
                    onChange={(fill) => updateSelectedText({ fill })}
                  />

                  <div className="rounded-2 border border-border-gray bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold">Outline</span>
                      <span className="text-[11px] font-semibold text-soft-black/50">
                        {textSelection.strokeWidth}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={12}
                      step={1}
                      value={textSelection.strokeWidth}
                      onChange={(event) =>
                        updateSelectedText({
                          strokeWidth: Number(event.target.value),
                        })
                      }
                      aria-label="Text outline width"
                      className={cn("mb-2 h-1.5 w-full cursor-pointer accent-brand-blue", focusRing)}
                    />
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
                    </div>
                  </div>

                  <div className="rounded-2 border border-border-gray bg-white p-3">
                    <button
                      type="button"
                      aria-pressed={textSelection.shadow}
                      onClick={() =>
                        updateSelectedText({ shadow: !textSelection.shadow })
                      }
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-[12px] font-semibold duration-200",
                        textSelection.shadow
                          ? "border-brand-blue bg-brand-blue-light text-soft-black"
                          : "border-border-gray bg-white text-soft-black/70 hover:bg-warm-white",
                        focusRing
                      )}
                    >
                      Text shadow
                      <span>{textSelection.shadow ? "On" : "Off"}</span>
                    </button>

                    {textSelection.shadow && (
                      <div className="mt-3 flex flex-col gap-2">
                        {[
                          { key: "shadowX" as const, label: "Shadow X", min: -40, max: 40 },
                          { key: "shadowY" as const, label: "Shadow Y", min: -40, max: 40 },
                          { key: "shadowBlur" as const, label: "Blur", min: 0, max: 60 },
                        ].map((control) => (
                          <label
                            key={control.key}
                            className="flex items-center gap-2 text-[11px] font-semibold text-soft-black/60"
                          >
                            <span className="w-16">{control.label}</span>
                            <input
                              type="range"
                              min={control.min}
                              max={control.max}
                              value={textSelection[control.key]}
                              onChange={(event) =>
                                updateSelectedText({
                                  [control.key]: Number(event.target.value),
                                })
                              }
                              aria-label={control.label}
                              className={cn("h-1.5 w-full cursor-pointer accent-brand-blue", focusRing)}
                            />
                            <span className="w-7 text-right tabular-nums">
                              {textSelection[control.key]}
                            </span>
                          </label>
                        ))}
                        <ColorPicker
                          label="Shadow color"
                          value={textSelection.shadowColor}
                          onChange={(shadowColor) =>
                            updateSelectedText({ shadowColor })
                          }
                        />
                      </div>
                    )}
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
              <div className="rounded-2 border border-border-gray bg-white p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
                  <SlidersHorizontal className="h-4 w-4 text-brand-blue" aria-hidden />
                  Color grading
                </div>
                <div className="flex flex-col gap-3">
                  {[
                    { key: "exposure" as const, label: "Exposure", min: -100, max: 100 },
                    { key: "contrast" as const, label: "Contrast", min: -100, max: 100 },
                    { key: "saturation" as const, label: "Saturation", min: -100, max: 100 },
                    { key: "temperature" as const, label: "Temperature", min: -100, max: 100 },
                  ].map((control) => (
                    <label
                      key={control.key}
                      className="flex flex-col gap-1.5 text-[12px] font-semibold text-soft-black/60"
                    >
                      <span className="flex items-center justify-between">
                        <span>{control.label}</span>
                        <span className="tabular-nums text-soft-black">
                          {colorGrade[control.key] > 0 ? "+" : ""}
                          {colorGrade[control.key]}
                        </span>
                      </span>
                      <input
                        type="range"
                        min={control.min}
                        max={control.max}
                        value={colorGrade[control.key]}
                        onChange={(event) => {
                          setColorGrade((current) => ({
                            ...current,
                            [control.key]: Number(event.target.value),
                          }));
                          setActiveFilter("custom");
                          markDirty();
                        }}
                        aria-label={control.label}
                        className={cn("h-1.5 w-full cursor-pointer accent-brand-blue", focusRing)}
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setColorGrade(NO_GRADE);
                    setActiveFilter("original");
                    markDirty();
                  }}
                  className={cn(
                    "mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-border-gray bg-warm-white px-3 py-2 text-[12px] font-semibold duration-200 hover:bg-brand-blue-light",
                    focusRing
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reset grade
                </button>
              </div>

              <div className="rounded-2 border border-border-gray bg-white p-3">
                <p className="mb-2 text-[13px] font-semibold">Filter presets</p>
                <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                  {FILTER_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      aria-pressed={activeFilter === preset.id}
                      onClick={() => {
                        setActiveFilter(preset.id);
                        setColorGrade({ ...preset.grade });
                        markDirty();
                      }}
                      className={cn(
                        "flex w-[74px] shrink-0 flex-col items-center gap-1 rounded-lg border-2 p-1 duration-200",
                        activeFilter === preset.id
                          ? "border-brand-blue"
                          : "border-border-gray hover:border-brand-blue-light",
                        focusRing
                      )}
                    >
                      <span
                        className="h-9 w-full rounded-md"
                        style={{ backgroundImage: preset.swatch }}
                        aria-hidden
                      />
                      <span className="text-[10px] font-semibold text-soft-black/70">
                        {preset.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2 border border-border-gray bg-white p-3">
                <CustomSelect
                  label="Export resolution"
                  value={resolution}
                  onValueChange={(value) => {
                    setResolution(value === "4K" ? "4K" : "1080p");
                    markDirty();
                  }}
                  options={RESOLUTIONS}
                />
                <p className="mt-2 text-[11px] leading-relaxed text-soft-black/50">
                  Color grading is previewed live and baked into the final
                  render with FFmpeg.
                </p>
              </div>
            </Tabs.Content>

            <Tabs.Content value="layers" className="flex flex-col gap-2">
              <p className="text-[12px] text-soft-black/50">
                Topmost layers appear first. Select a layer to edit it on the
                canvas.
              </p>
              <div className="flex flex-col gap-2">
                {layers.map((layer) => {
                  const activeObject = canvasRef.current?.getActiveObject() ?? null;
                  const isActive =
                    layer.kind === "video"
                      ? activeObject === null
                      : layer.object === activeObject;
                  return (
                    <div
                      key={layer.id}
                      className={cn(
                        "flex items-center gap-2 rounded-2 border bg-white p-2",
                        isActive ? "border-brand-blue" : "border-border-gray"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => selectLayer(layer)}
                        className={cn(
                          "flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left duration-200 hover:bg-warm-white",
                          focusRing
                        )}
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-blue-light text-brand-blue">
                          {layer.kind === "video" ? (
                            <Film className="h-3.5 w-3.5" aria-hidden />
                          ) : layer.kind === "text" ? (
                            <Type className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                          )}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-soft-black">
                          {layer.label}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(layer, "back")}
                        disabled={layer.kind === "video"}
                        aria-label={`Send ${layer.label} to back`}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md border border-border-gray text-soft-black/60 duration-200 hover:bg-warm-white disabled:opacity-30",
                          focusRing
                        )}
                      >
                        <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveLayer(layer, "front")}
                        disabled={layer.kind === "video"}
                        aria-label={`Bring ${layer.label} to front`}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md border border-border-gray text-soft-black/60 duration-200 hover:bg-warm-white disabled:opacity-30",
                          focusRing
                        )}
                      >
                        <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLayer(layer)}
                        disabled={layer.kind === "video"}
                        aria-label={`Delete ${layer.label}`}
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-600 duration-200 hover:bg-red-50 disabled:opacity-30",
                          focusRing
                        )}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  );
                })}
              </div>
            </Tabs.Content>

          </Tabs.Root>
        </aside>
      </div>

      <Dialog.Root open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-soft-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
              "rounded-3 border border-border-gray bg-white p-6 shadow-xl",
              focusRing
            )}
          >
            <Dialog.Title className="text-[24px] font-bold leading-[1.25] text-soft-black">
              Unsaved Changes
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-soft-black/60">
              You have unsaved changes in this project. If you leave now, your
              edits will be lost.
            </Dialog.Description>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
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
                onClick={() => {
                  setLeaveDialogOpen(false);
                  setHasUnsavedChanges(false);
                  router.push("/dashboard");
                }}
                className={cn(
                  "inline-flex items-center justify-center rounded-2 bg-red-500 px-5 py-2.5 text-[14px] font-semibold text-white duration-200 hover:bg-red-600",
                  focusRing
                )}
              >
                Discard Changes
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
