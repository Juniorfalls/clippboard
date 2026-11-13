"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import * as fabric from "fabric";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ImagePlus,
  Italic,
  Loader2,
  Minus,
  Plus,
  Trash2,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/CustomSelect";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import type { Clip } from "@/types/video";

const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 720;

const FONT_OPTIONS = [
  { value: "Inter, sans-serif", label: "Inter" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "Impact, sans-serif", label: "Impact" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: "'Arial Black', sans-serif", label: "Arial Black" },
];

const BACKGROUNDS = [
  { label: "Brand Blue", value: "#3B82F6" },
  { label: "Soft Black", value: "#1C1C1C" },
  { label: "White", value: "#FFFFFF" },
];

const TEXT_COLORS = ["#FFFFFF", "#1C1C1C", "#3B82F6", "#FDE047", "#EF4444"];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const inputClass = cn(
  "block w-full rounded-2 border border-border-gray bg-white px-3.5 py-2.5 text-[14px] text-soft-black placeholder:text-soft-black/40 duration-200",
  focusRing
);

type TextState = {
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

const DEFAULT_TEXT: TextState = {
  text: "YOUR HEADLINE",
  fontFamily: "Arial Black, sans-serif",
  fontSize: 96,
  fill: "#FFFFFF",
  bold: true,
  italic: false,
  align: "left",
  stroke: "#1C1C1C",
  strokeWidth: 0,
  shadow: false,
};

function isTextObject(
  object: fabric.FabricObject | null
): object is fabric.IText {
  return Boolean(object && "text" in object && "fontSize" in object);
}

function applyShadow(
  object: fabric.IText,
  enabled: boolean,
  strokeColor: string
) {
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
  object.set("stroke", strokeColor);
}

export function ThumbnailEditor({
  clip,
  userId,
  onSaved,
}: {
  clip: Clip;
  userId: string;
  onSaved?: (thumbnailUrl: string) => void;
}) {
  const canvasElementRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = useRef<fabric.Canvas | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundRef = useRef<fabric.Rect | null>(null);

  const [background, setBackground] = useState("#3B82F6");
  const [selectedKind, setSelectedKind] = useState<"text" | "image" | null>(
    null
  );
  const [text, setText] = useState<TextState>(DEFAULT_TEXT);
  const [isSaving, setIsSaving] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const syncFromSelection = useCallback(
    (object: fabric.FabricObject | null) => {
      if (!object) {
        setSelectedKind(null);
        return;
      }

      setSelectedKind(isTextObject(object) ? "text" : "image");

      if (isTextObject(object)) {
        setText({
          text: object.text ?? "",
          fontFamily: String(object.fontFamily ?? "Arial"),
          fontSize: Math.round(Number(object.fontSize ?? 96)),
          fill:
            typeof object.fill === "string" ? object.fill : DEFAULT_TEXT.fill,
          bold: Number(object.fontWeight ?? 400) >= 600,
          italic: object.fontStyle === "italic",
          align: (object.textAlign as TextState["align"]) ?? "left",
          stroke:
            typeof object.stroke === "string"
              ? object.stroke
              : DEFAULT_TEXT.stroke,
          strokeWidth: Number(object.strokeWidth ?? 0),
          shadow: Boolean(object.shadow),
        });
      }
    },
    []
  );

  // Initialize the Fabric canvas once per clip.
  useEffect(() => {
    const element = canvasElementRef.current;
    if (!element) return;

    const canvas = new fabric.Canvas(element, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      preserveObjectStacking: true,
      selection: true,
    });
    canvasRef.current = canvas;
    setIsReady(true);

    const backgroundRect = new fabric.Rect({
      left: 0,
      top: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fill: "#3B82F6",
      selectable: false,
      evented: false,
      hoverCursor: "default",
    });
    backgroundRef.current = backgroundRect;
    canvas.add(backgroundRect);

    const handleSelection = () => {
      syncFromSelection(canvas.getActiveObject() ?? null);
    };
    canvas.on("selection:created", handleSelection);
    canvas.on("selection:updated", handleSelection);
    canvas.on("selection:cleared", handleSelection);
    canvas.on("object:modified", handleSelection);

    return () => {
      canvas.off("selection:created", handleSelection);
      canvas.off("selection:updated", handleSelection);
      canvas.off("selection:cleared", handleSelection);
      canvas.off("object:modified", handleSelection);
      void canvas.dispose();
      canvasRef.current = null;
      backgroundRef.current = null;
      setIsReady(false);
    };
  }, [clip.id, syncFromSelection]);

  // Load the clip frame as the image layer.
  useEffect(() => {
    const canvas = canvasRef.current;
    const source = clip.storageUrl ?? clip.url;
    if (!canvas || !source) return;

    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;

    const placeFrame = async () => {
      if (cancelled) return;

      try {
        const frame = document.createElement("canvas");
        frame.width = video.videoWidth;
        frame.height = video.videoHeight;
        const context = frame.getContext("2d");
        if (!context) return;
        context.drawImage(video, 0, 0, frame.width, frame.height);

        const image = new fabric.Image(frame, {
          selectable: false,
          evented: false,
        });
        const scale = Math.max(
          CANVAS_WIDTH / frame.width,
          CANVAS_HEIGHT / frame.height
        );
        image.set({
          scaleX: scale,
          scaleY: scale,
          left: (CANVAS_WIDTH - frame.width * scale) / 2,
          top: (CANVAS_HEIGHT - frame.height * scale) / 2,
        });

        const current = canvasRef.current;
        if (!current || cancelled) return;
        const existing = current
          .getObjects()
          .find((object) => object instanceof fabric.Image);
        if (existing) current.remove(existing);
        current.add(image);
        const backgroundRect = backgroundRef.current;
        if (backgroundRect) current.sendObjectToBack(backgroundRect);
        current.requestRenderAll();
      } catch (error) {
        console.warn("[thumbnail] Could not draw the clip frame.", error);
      }
    };

    video.onloadeddata = () => {
      if (cancelled) return;
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      const target = Math.min(
        Math.max(clip.startTime, 0),
        Math.max(duration - 0.1, 0)
      );
      if (Math.abs(video.currentTime - target) > 0.01) {
        video.currentTime = target;
      } else {
        void placeFrame();
      }
    };
    video.onseeked = () => void placeFrame();
    video.onerror = () =>
      console.warn("[thumbnail] The clip frame could not be loaded.");

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
  }, [clip.startTime, clip.storageUrl, clip.url]);

  // Keep the background layer in sync.
  useEffect(() => {
    const backgroundRect = backgroundRef.current;
    if (!backgroundRect) return;
    backgroundRect.set("fill", background);
    backgroundRect.canvas?.requestRenderAll();
  }, [background]);

  function addTextLayer() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const layer = new fabric.IText(DEFAULT_TEXT.text, {
      left: 70,
      top: CANVAS_HEIGHT / 2 - 60,
      fontFamily: DEFAULT_TEXT.fontFamily,
      fontSize: DEFAULT_TEXT.fontSize,
      fill: "#FFFFFF",
      fontWeight: 900,
      lineHeight: 1.05,
      textAlign: "left",
      originX: "left",
      originY: "top",
      shadow: new fabric.Shadow({
        color: "rgba(0,0,0,0.45)",
        blur: 16,
        offsetX: 5,
        offsetY: 6,
      }),
    });
    applyShadow(layer, false, DEFAULT_TEXT.stroke);

    canvas.add(layer);
    canvas.setActiveObject(layer);
    canvas.requestRenderAll();
    syncFromSelection(layer);
  }

  async function addImageLayer(file: File) {
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
      const maxSize = CANVAS_WIDTH * 0.4;
      const scale = Math.min(
        maxSize / (image.width ?? maxSize),
        maxSize / (image.height ?? maxSize),
        1
      );
      image.set({
        left: CANVAS_WIDTH / 2 - ((image.width ?? 0) * scale) / 2,
        top: CANVAS_HEIGHT / 2 - ((image.height ?? 0) * scale) / 2,
        scaleX: scale,
        scaleY: scale,
      });

      canvas.add(image);
      canvas.setActiveObject(image);
      canvas.requestRenderAll();
      syncFromSelection(image);
    } catch (error) {
      toast.error("Could not add that image", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  function updateSelectedText(update: Partial<TextState>) {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() ?? null;
    if (!isTextObject(active)) {
      setText((current) => ({ ...current, ...update }));
      return;
    }

    setText((current) => ({ ...current, ...update }));
    const next = { ...text, ...update };

    active.set({
      text: next.text,
      fontFamily: next.fontFamily,
      fontSize: next.fontSize,
      fill: next.fill,
      fontWeight: next.bold ? "bold" : "normal",
      fontStyle: next.italic ? "italic" : "normal",
      textAlign: next.align,
      strokeWidth: next.strokeWidth,
    });
    applyShadow(active, next.shadow, next.stroke);
    active.canvas?.requestRenderAll();
  }

  function deleteSelected() {
    const canvas = canvasRef.current;
    const active = canvas?.getActiveObject() ?? null;
    if (!canvas || !active || active === backgroundRef.current) return;
    canvas.remove(active);
    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setSelectedKind(null);
  }

  async function saveThumbnail() {
    const canvas = canvasRef.current;
    if (!canvas || isSaving) return;

    canvas.discardActiveObject();
    canvas.requestRenderAll();
    setIsSaving(true);

    try {
      const dataUrl = canvas.toDataURL({ format: "png", multiplier: 1 });
      const blob = await (await fetch(dataUrl)).blob();
      if (blob.size === 0) throw new Error("The thumbnail is empty.");

      const file = new File([blob], `thumbnail-${clip.id}.png`, {
        type: "image/png",
      });
      const uploaded = await upload(
        `thumbnails/${userId}/designed-${clip.id}-${Date.now()}.png`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/upload",
          contentType: "image/png",
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

      onSaved?.(uploaded.url);
      toast.success("Thumbnail updated!");
    } catch (error) {
      console.error("Thumbnail save failed:", error);
      toast.error("Could not save thumbnail", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 md:col-span-2">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_250px] sm:items-start">
        <div className="overflow-hidden rounded-2 border-4 border-brand-blue-light bg-warm-white shadow-xl">
          <div className="aspect-video w-full max-w-[600px]">
            <canvas
              ref={canvasElementRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="block h-full w-full"
              aria-label="Thumbnail design canvas"
            />
          </div>
          {!isReady && (
            <p className="px-3 py-2 text-[12px] text-soft-black/50">
              Preparing the design canvas...
            </p>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={addTextLayer}
              disabled={!isReady}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-2 bg-brand-blue px-3 py-2 text-[12px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light",
                focusRing
              )}
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Add Text
            </button>
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={!isReady}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-2 border border-border-gray bg-white px-3 py-2 text-[12px] font-semibold text-soft-black duration-200 hover:bg-warm-white disabled:cursor-not-allowed disabled:opacity-60",
                focusRing
              )}
            >
              <ImagePlus className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
              Add Image
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void addImageLayer(file);
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold text-soft-black">
              Background
            </span>
            <div className="flex flex-wrap gap-2">
              {BACKGROUNDS.map((option) => {
                const active = background === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    aria-label={`${option.label} background`}
                    onClick={() => setBackground(option.value)}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2 duration-200",
                      active
                        ? "border-brand-blue ring-2 ring-brand-blue-light"
                        : "border-border-gray hover:border-brand-blue",
                      focusRing
                    )}
                    style={{ backgroundColor: option.value }}
                  />
                );
              })}
            </div>
          </div>

          {selectedKind === "text" ? (
            <div className="flex flex-col gap-3 rounded-2 border border-border-gray bg-warm-white p-3">
              <label
                htmlFor="layer-text"
                className="text-[13px] font-semibold text-soft-black"
              >
                Text
              </label>
              <textarea
                id="layer-text"
                value={text.text}
                onChange={(event) =>
                  updateSelectedText({ text: event.target.value })
                }
                rows={3}
                className={cn(inputClass, "resize-none leading-relaxed")}
              />

              <CustomSelect
                label="Font"
                value={text.fontFamily}
                onValueChange={(value) =>
                  updateSelectedText({ fontFamily: value })
                }
                options={FONT_OPTIONS}
              />

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-soft-black">
                  Font size
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Decrease font size"
                    onClick={() =>
                      updateSelectedText({
                        fontSize: Math.max(24, text.fontSize - 4),
                      })
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border border-border-gray bg-white text-soft-black duration-200 hover:bg-warm-white",
                      focusRing
                    )}
                  >
                    <Minus className="h-4 w-4" aria-hidden />
                  </button>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={text.fontSize}
                    onChange={(event) => {
                      const value = Number(
                        event.target.value.replace(/[^0-9]/g, "")
                      );
                      updateSelectedText({
                        fontSize: Math.min(220, Math.max(24, value || 24)),
                      });
                    }}
                    aria-label="Font size in pixels"
                    className={cn(inputClass, "w-16 text-center")}
                  />
                  <span className="text-[12px] font-semibold text-soft-black/50">
                    px
                  </span>
                  <button
                    type="button"
                    aria-label="Increase font size"
                    onClick={() =>
                      updateSelectedText({
                        fontSize: Math.min(220, text.fontSize + 4),
                      })
                    }
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border border-border-gray bg-white text-soft-black duration-200 hover:bg-warm-white",
                      focusRing
                    )}
                  >
                    <Plus className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-soft-black">
                  Text color
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {TEXT_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-pressed={text.fill === color}
                      aria-label={`Text color ${color}`}
                      onClick={() => updateSelectedText({ fill: color })}
                      className={cn(
                        "h-7 w-7 rounded-full border-2 duration-200",
                        text.fill === color
                          ? "border-brand-blue ring-2 ring-brand-blue-light"
                          : "border-border-gray",
                        focusRing
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <input
                    type="text"
                    value={text.fill}
                    onChange={(event) =>
                      updateSelectedText({ fill: event.target.value })
                    }
                    aria-label="Text color hex"
                    spellCheck={false}
                    className={cn(inputClass, "w-[92px] uppercase")}
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={text.bold}
                  aria-label="Bold"
                  onClick={() => updateSelectedText({ bold: !text.bold })}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border duration-200",
                    text.bold
                      ? "border-brand-blue bg-brand-blue-light"
                      : "border-border-gray bg-white hover:bg-warm-white",
                    focusRing
                  )}
                >
                  <Bold className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-pressed={text.italic}
                  aria-label="Italic"
                  onClick={() => updateSelectedText({ italic: !text.italic })}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg border duration-200",
                    text.italic
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
                    aria-pressed={text.align === align}
                    aria-label={`Align ${align}`}
                    onClick={() => updateSelectedText({ align })}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border duration-200",
                      text.align === align
                        ? "border-brand-blue bg-brand-blue-light"
                        : "border-border-gray bg-white hover:bg-warm-white",
                      focusRing
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden />
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-soft-black">
                  Outline
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {["#1C1C1C", "#FFFFFF", "#3B82F6"].map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-pressed={text.stroke === color}
                      aria-label={`Outline ${color}`}
                      onClick={() =>
                        updateSelectedText({
                          stroke: color,
                          strokeWidth: text.strokeWidth || 4,
                        })
                      }
                      className={cn(
                        "h-7 w-7 rounded-full border-2 duration-200",
                        text.stroke === color
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
                        strokeWidth: text.strokeWidth ? 0 : 4,
                      })
                    }
                    className={cn(
                      "rounded-lg border px-2 py-1 text-[11px] font-semibold duration-200",
                      text.strokeWidth
                        ? "border-brand-blue bg-brand-blue-light text-soft-black"
                        : "border-border-gray bg-white text-soft-black/70",
                      focusRing
                    )}
                  >
                    {text.strokeWidth ? "On" : "Off"}
                  </button>
                </div>
              </div>

              <button
                type="button"
                aria-pressed={text.shadow}
                onClick={() => updateSelectedText({ shadow: !text.shadow })}
                className={cn(
                  "w-full rounded-lg border px-3 py-2 text-[12px] font-semibold duration-200",
                  text.shadow
                    ? "border-brand-blue bg-brand-blue-light text-soft-black"
                    : "border-border-gray bg-white text-soft-black/70 hover:bg-warm-white",
                  focusRing
                )}
              >
                Drop shadow {text.shadow ? "on" : "off"}
              </button>

              <button
                type="button"
                onClick={deleteSelected}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-600 duration-200 hover:bg-red-50",
                  focusRing
                )}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete layer
              </button>
            </div>
          ) : selectedKind === "image" ? (
            <div className="flex flex-col gap-2 rounded-2 border border-border-gray bg-warm-white p-3">
              <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-soft-black">
                <ImagePlus className="h-4 w-4 text-brand-blue" aria-hidden />
                Image layer selected
              </span>
              <p className="text-[12px] text-soft-black/50">
                Drag to move or use the corner handles to resize. New images sit
                above the video frame.
              </p>
              <button
                type="button"
                onClick={deleteSelected}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-[12px] font-semibold text-red-600 duration-200 hover:bg-red-50",
                  focusRing
                )}
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                Delete layer
              </button>
            </div>
          ) : (
            <div className="rounded-2 border border-dashed border-border-gray bg-warm-white p-3 text-[12px] leading-relaxed text-soft-black/55">
              <span className="inline-flex items-center gap-1.5 font-semibold text-soft-black">
                <Type className="h-4 w-4 text-brand-blue" aria-hidden />
                No layer selected
              </span>
              <p className="mt-1">
                Select a layer on the canvas, or add text and images to build
                your thumbnail.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12px] leading-relaxed text-soft-black/50">
          Exports at {CANVAS_WIDTH}×{CANVAS_HEIGHT}. The video frame is locked as
          the base layer.
        </p>
        <button
          type="button"
          onClick={() => void saveThumbnail()}
          disabled={isSaving || !isReady}
          aria-busy={isSaving}
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
            focusRing
          )}
        >
          {isSaving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ImagePlus className="h-4 w-4" aria-hidden />
          )}
          {isSaving ? "Saving thumbnail..." : "Save Thumbnail"}
        </button>
      </div>
    </div>
  );
}
