"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as fabric from "fabric";
import { ImageIcon, LayoutPanelTop, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

const BACKGROUNDS = [
  { label: "Soft Black", value: "#1C1C1C" },
  { label: "Brand Blue", value: "#3B82F6" },
  { label: "Warm White", value: "#F9F7F4" },
];

const TEXT_COLORS = ["#FFFFFF", "#1C1C1C", "#3B82F6", "#FDE047"];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export type ThumbnailClip = {
  url: string;
  kind: "video" | "image";
  name: string;
};

function extractVideoFrame(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const finish = () => {
      if (!video.videoWidth || !video.videoHeight) {
        reject(new Error("The clip frame could not be read."));
        return;
      }
      const frame = document.createElement("canvas");
      frame.width = video.videoWidth;
      frame.height = video.videoHeight;
      const context = frame.getContext("2d");
      if (!context) {
        reject(new Error("The clip frame could not be drawn."));
        return;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.drawImage(video, 0, 0, frame.width, frame.height);
      resolve(frame.toDataURL("image/png"));
    };

    video.onloadeddata = () => {
      const target = Math.min(0.1, Math.max(video.duration - 0.1, 0));
      if (target > 0.01) video.currentTime = target;
      else finish();
    };
    video.onseeked = finish;
    video.onerror = () => reject(new Error("The clip frame could not load."));
    video.src = url;
    video.load();
  });
}

export function EditorThumbnailPanel({
  firstClip,
  onChange,
}: {
  firstClip: ThumbnailClip | null;
  onChange: (dataUrl: string | null) => void;
}) {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const frameObjectRef = useRef<fabric.Image | null>(null);
  const frameDataRef = useRef<string | null>(null);
  const [background, setBackground] = useState(BACKGROUNDS[0].value);
  const [layout, setLayout] = useState<"cover" | "contain">("cover");
  const [hasFrame, setHasFrame] = useState(false);
  const [textColor, setTextColor] = useState("#FFFFFF");
  const [isReady, setIsReady] = useState(false);

  const emit = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.requestRenderAll();
    onChange(canvas.toDataURL({ format: "png", multiplier: 1 }));
  }, [onChange]);

  useEffect(() => {
    const element = canvasElementRef.current;
    if (!element) return;

    const canvas = new fabric.Canvas(element, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      preserveObjectStacking: true,
      selection: true,
    });
    canvas.backgroundColor = BACKGROUNDS[0].value;
    canvasRef.current = canvas;
    setIsReady(true);

    const handleChange = () => emit();
    canvas.on("object:modified", handleChange);
    canvas.on("object:removed", handleChange);

    return () => {
      canvas.off("object:modified", handleChange);
      canvas.off("object:removed", handleChange);
      void canvas.dispose();
      canvasRef.current = null;
      frameObjectRef.current = null;
      setIsReady(false);
    };
  }, [emit]);

  // Load the first clip frame as the thumbnail background.
  useEffect(() => {
    let cancelled = false;

    async function loadFrame() {
      const canvas = canvasRef.current;
      if (!canvas || !firstClip) {
        setHasFrame(false);
        return;
      }

      try {
        const dataUrl =
          firstClip.kind === "image"
            ? firstClip.url
            : await extractVideoFrame(firstClip.url);
        if (cancelled) return;
        frameDataRef.current = dataUrl;
        await placeFrame(dataUrl);
      } catch (error) {
        if (!cancelled) {
          setHasFrame(false);
          toast.error("Could not load the clip frame", {
            description:
              error instanceof Error ? error.message : "Try another clip.",
          });
        }
      }
    }

    async function placeFrame(dataUrl: string) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const previous = frameObjectRef.current;
      if (previous) canvas.remove(previous);

      const image = await fabric.Image.fromURL(dataUrl);
      if (cancelled) return;
      frameObjectRef.current = image;
      applyFrameLayout(image, layout);
      canvas.add(image);
      canvas.sendObjectToBack(image);
      canvas.requestRenderAll();
      setHasFrame(true);
      emit();
    }

    void loadFrame();

    return () => {
      cancelled = true;
    };
    // Re-extract only when the source clip changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstClip?.url, firstClip?.kind, emit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameObjectRef.current;
    if (!canvas || !frame) return;
    applyFrameLayout(frame, layout);
    canvas.requestRenderAll();
    emit();
  }, [layout, emit]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.backgroundColor = background;
    canvas.requestRenderAll();
    emit();
  }, [background, emit]);

  function applyFrameLayout(image: fabric.Image, mode: "cover" | "contain") {
    const width = image.width ?? CANVAS_WIDTH;
    const height = image.height ?? CANVAS_HEIGHT;
    const scale =
      mode === "cover"
        ? Math.max(CANVAS_WIDTH / width, CANVAS_HEIGHT / height)
        : Math.min(CANVAS_WIDTH / width, CANVAS_HEIGHT / height);
    image.set({
      scaleX: scale,
      scaleY: scale,
      originX: "center",
      originY: "center",
      left: CANVAS_WIDTH / 2,
      top: CANVAS_HEIGHT / 2,
      selectable: false,
      evented: false,
    });
  }

  function addText(preset: "headline" | "subtitle") {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isHeadline = preset === "headline";
    const layer = new fabric.IText(
      isHeadline ? "YOUR HEADLINE" : "Your subtitle",
      {
        left: CANVAS_WIDTH / 2,
        top: isHeadline ? CANVAS_HEIGHT * 0.42 : CANVAS_HEIGHT * 0.72,
        originX: "center",
        originY: "center",
        fontFamily: isHeadline ? "Impact, sans-serif" : "Inter, sans-serif",
        fontSize: isHeadline ? 72 : 36,
        fontWeight: isHeadline ? "bold" : "600",
        fill: textColor,
        stroke: isHeadline ? "#1C1C1C" : undefined,
        strokeWidth: isHeadline ? 3 : 0,
        shadow: new fabric.Shadow({
          color: "rgba(0,0,0,0.55)",
          blur: 16,
          offsetX: 5,
          offsetY: 6,
        }),
      }
    );

    layer.on("changed", emit);
    canvas.add(layer);
    canvas.setActiveObject(layer);
    canvas.requestRenderAll();
    emit();
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() ?? null;
    if (!canvas || !active || active === frameObjectRef.current) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    emit();
  }

  function updateTextColor(color: string) {
    setTextColor(color);
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() ?? null;
    if (active && "text" in active) {
      active.set("fill", color);
      canvas?.requestRenderAll();
      emit();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="thumbnail-canvas aspect-video w-full overflow-hidden rounded-lg border-4 border-brand-blue-light bg-soft-black shadow-lg">
        <canvas
          ref={canvasElementRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          className="block h-full w-full"
          aria-label="Thumbnail design canvas"
        />
      </div>

      {!hasFrame && (
        <p className="rounded-lg border border-dashed border-border-gray bg-white p-2 text-[11px] text-soft-black/55">
          {firstClip
            ? "Loading a frame from the first timeline clip..."
            : "Add a video or image to the timeline to use its frame."}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => addText("headline")}
          disabled={!isReady}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-2 bg-brand-blue px-3 py-2 text-[12px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:opacity-60",
            focusRing
          )}
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Headline
        </button>
        <button
          type="button"
          onClick={() => addText("subtitle")}
          disabled={!isReady}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-2 border border-border-gray bg-white px-3 py-2 text-[12px] font-semibold text-soft-black duration-200 hover:bg-warm-white disabled:opacity-60",
            focusRing
          )}
        >
          <Plus className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
          Subtitle
        </button>
      </div>

      <div className="rounded-2 border border-border-gray bg-white p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold">
          <LayoutPanelTop className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
          Frame layout
        </p>
        <div className="grid grid-cols-2 gap-1 rounded-lg border border-border-gray bg-warm-white p-1">
          {(["cover", "contain"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={layout === mode}
              onClick={() => setLayout(mode)}
              className={cn(
                "rounded-md px-2 py-1.5 text-[12px] font-semibold capitalize duration-200",
                layout === mode
                  ? "bg-white text-soft-black shadow-sm"
                  : "text-soft-black/60 hover:text-soft-black",
                focusRing
              )}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2 border border-border-gray bg-white p-3">
        <p className="mb-2 text-[12px] font-semibold">Background</p>
        <div className="flex flex-wrap gap-2">
          {BACKGROUNDS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-label={`${option.label} background`}
              aria-pressed={background === option.value}
              onClick={() => setBackground(option.value)}
              className={cn(
                "h-8 w-8 rounded-full border-2 duration-200",
                background === option.value
                  ? "border-brand-blue ring-2 ring-brand-blue-light"
                  : "border-border-gray",
                focusRing
              )}
              style={{ backgroundColor: option.value }}
            />
          ))}
        </div>
      </div>

      <div className="rounded-2 border border-border-gray bg-white p-3">
        <p className="mb-2 text-[12px] font-semibold">Text color</p>
        <div className="flex flex-wrap gap-2">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              aria-label={`Text color ${color}`}
              aria-pressed={textColor === color}
              onClick={() => updateTextColor(color)}
              className={cn(
                "h-7 w-7 rounded-full border-2 duration-200",
                textColor === color
                  ? "border-brand-blue ring-2 ring-brand-blue-light"
                  : "border-border-gray",
                focusRing
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
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
        Delete selected text
      </button>

      <p className="inline-flex items-center gap-1.5 text-[11px] leading-relaxed text-soft-black/50">
        <ImageIcon className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
        The first timeline clip supplies the frame. Drag text to reposition.
      </p>
    </div>
  );
}
