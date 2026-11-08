"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { Check, ImagePlus, Palette, Save, Trash2, Type, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/CustomSelect";
import {
  BRAND_FONT_OPTIONS,
  DEFAULT_BRAND_KIT,
  isValidHexColor,
  loadBrandKit,
  saveBrandKit,
  type BrandKit,
} from "@/lib/brand-kit";
import { cn } from "@/lib/utils";

const MAX_LOGO_SIZE = 512 * 1024;
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function BrandKitForm({ userId }: { userId: string }) {
  const [brandKit, setBrandKit] = useState<BrandKit>(DEFAULT_BRAND_KIT);
  const [colorError, setColorError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setBrandKit(loadBrandKit(userId));
  }, [userId]);

  const onDrop = useCallback((accepted: File[], rejected: FileRejection[]) => {
    if (rejected.length > 0) {
      toast.error(
        rejected[0].errors[0]?.code === "file-too-large"
          ? "That logo is over 512 KB"
          : "Upload a PNG, JPG, WebP or SVG logo",
        { description: rejected[0].file.name }
      );
      return;
    }

    const file = accepted[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setBrandKit((current) => ({ ...current, logo: reader.result as string }));
        toast.success("Logo added", { description: file.name });
      }
    };
    reader.onerror = () => {
      toast.error("Could not read that logo", { description: "Try another file." });
    };
    reader.readAsDataURL(file);
  }, []);

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: {
      "image/png": [".png"],
      "image/jpeg": [".jpg", ".jpeg"],
      "image/webp": [".webp"],
      "image/svg+xml": [".svg"],
    },
    maxSize: MAX_LOGO_SIZE,
    multiple: false,
    noClick: true,
    noKeyboard: true,
  });

  logoInputRef.current = open;

  function handleHexChange(value: string) {
    setBrandKit((current) => ({ ...current, color: value }));
    setColorError(
      isValidHexColor(value) ? "" : "Use a 6-digit hex value, e.g. #3B82F6."
    );
  }

  function handleSave() {
    const color = brandKit.color.trim().toUpperCase();

    if (!isValidHexColor(color)) {
      setColorError("Use a 6-digit hex value, e.g. #3B82F6.");
      toast.error("That brand color is not valid", {
        description: "Enter a hex code such as #3B82F6.",
      });
      return;
    }

    setIsSaving(true);
    saveBrandKit(userId, { ...brandKit, color });
    setBrandKit((current) => ({ ...current, color }));
    setColorError("");
    setIsSaving(false);
    toast.success("Brand kit saved", {
      description: "New clips will use your colors, font and logo.",
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
      <section className="flex flex-col gap-6 rounded-3 border border-border-gray bg-white p-5 md:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-[24px] font-bold leading-[1.25]">Brand identity</h2>
          <p className="text-[14px] text-soft-black/60">
            These defaults are applied to captions, overlays and clip styling.
          </p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="brand-color"
              className="text-[14px] font-semibold text-soft-black"
            >
              Brand color
            </label>
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2 border border-border-gray"
                style={{ backgroundColor: isValidHexColor(brandKit.color) ? brandKit.color : "#E5E7EB" }}
              >
                <Palette className="h-5 w-5 text-white drop-shadow" />
              </span>
              <input
                id="brand-color"
                type="text"
                value={brandKit.color}
                onChange={(event) => handleHexChange(event.target.value)}
                placeholder="#3B82F6"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(colorError)}
                aria-describedby="brand-color-help"
                className={cn(
                  "w-full rounded-2xl border border-border-gray bg-white px-5 py-3.5 text-[16px] font-semibold uppercase text-soft-black",
                  "placeholder:text-soft-black/40 duration-200",
                  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
                  colorError && "border-red-300"
                )}
              />
            </div>
            <p
              id="brand-color-help"
              className={cn(
                "text-[14px] text-soft-black/60",
                colorError && "text-red-600"
              )}
            >
              {colorError || "Used for badges, handles and caption accents."}
            </p>
          </div>

          <CustomSelect
            label="Font style"
            value={brandKit.font}
            onValueChange={(value) =>
              setBrandKit((current) => ({ ...current, font: value }))
            }
            options={BRAND_FONT_OPTIONS}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-soft-black">
              Podcast layout
            </span>
            <div
              role="radiogroup"
              aria-label="Podcast layout"
              className="grid gap-2 sm:grid-cols-2"
            >
              {[
                { value: "single", label: "Single speaker" },
                { value: "split-screen", label: "Split screen" },
              ].map((option) => {
                const active = brandKit.layout === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() =>
                      setBrandKit((current) => ({
                        ...current,
                        layout: option.value as BrandKit["layout"],
                      }))
                    }
                    className={cn(
                      "rounded-2 border px-4 py-3 text-left text-[14px] font-semibold duration-200",
                      active
                        ? "border-brand-blue bg-brand-blue-light text-soft-black"
                        : "border-border-gray bg-white text-soft-black/70 hover:bg-warm-white hover:text-soft-black",
                      focusRing
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[14px] text-soft-black/60">
              Split screen stacks two face-tracked crops for podcast clips.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-soft-black">Logo</span>
            {brandKit.logo ? (
              <div className="flex items-center gap-4 rounded-2xl border border-border-gray bg-white p-4">
                <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border-gray bg-warm-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brandKit.logo}
                    alt="Brand logo preview"
                    className="h-full w-full object-contain"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold">Logo ready</p>
                  <p className="text-[14px] text-soft-black/60">
                    Shown on clip overlays.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.()}
                  className={cn(
                    "rounded-2 border border-border-gray bg-white px-3 py-2 text-[12px] font-semibold duration-200 hover:bg-warm-white",
                    focusRing
                  )}
                >
                  Replace
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setBrandKit((current) => ({ ...current, logo: null }))
                  }
                  aria-label="Remove logo"
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-lg text-soft-black/60 duration-200 hover:bg-warm-white hover:text-soft-black",
                    focusRing
                  )}
                >
                  <Trash2 className="h-5 w-5" aria-hidden />
                </button>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  "relative flex flex-col items-center rounded-2xl border-2 border-dashed p-6 text-center duration-200",
                  isDragActive
                    ? "border-brand-blue bg-brand-blue/10"
                    : "border-gray-300 bg-warm-white"
                )}
              >
                <input
                  {...getInputProps()}
                  className="pointer-events-none absolute opacity-0"
                  tabIndex={-1}
                />
                <ImagePlus
                  className={cn(
                    "mb-3 h-8 w-8",
                    isDragActive ? "text-brand-blue" : "text-soft-black/50"
                  )}
                  aria-hidden
                />
                <p className="text-[16px] font-semibold">
                  {isDragActive
                    ? "Drop your logo"
                    : "Drag & drop your logo, or browse"}
                </p>
                <p className="mt-1 text-[14px] text-soft-black/60">
                  PNG, JPG, WebP or SVG, up to 512 KB
                </p>
                <button
                  type="button"
                  onClick={open}
                  className={cn(
                    "mt-4 inline-flex items-center justify-center gap-2 rounded-2 border border-border-gray bg-white px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                    focusRing
                  )}
                >
                  <UploadCloud className="h-4 w-4" aria-hidden />
                  Choose logo
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-6 py-3 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
              focusRing,
              "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60"
            )}
          >
            <Save className="h-4 w-4" aria-hidden />
            {isSaving ? "Saving..." : "Save brand kit"}
          </button>
        </div>
      </section>

      <aside className="flex flex-col gap-4 rounded-3 border border-border-gray bg-white p-5">
        <div className="flex items-center gap-2 text-[14px] font-semibold text-soft-black/70">
          <Type className="h-4 w-4 text-brand-blue" aria-hidden />
          Live preview
        </div>
        <div className="overflow-hidden rounded-2 border-4 border-brand-blue-light bg-soft-black">
          <div className="flex aspect-[9/16] flex-col justify-between p-4">
            <div className="flex justify-end">
              {brandKit.logo ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white p-1.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brandKit.logo}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold text-warm-white/70">
                  Logo
                </span>
              )}
            </div>
            <div className="flex flex-col items-center gap-2 text-center">
              <span
                className="rounded-full px-3 py-1 text-[12px] font-bold text-soft-black"
                style={{ backgroundColor: isValidHexColor(brandKit.color) ? brandKit.color : "#3B82F6" }}
              >
                Viral Score 95
              </span>
              <p
                className="text-[22px] font-bold leading-[1.15] text-white"
                style={{ fontFamily: brandKit.font }}
              >
                This is your caption style
              </p>
              <span
                className="h-1.5 w-16 rounded-full"
                style={{ backgroundColor: isValidHexColor(brandKit.color) ? brandKit.color : "#3B82F6" }}
              />
            </div>
          </div>
        </div>
        <p className="flex items-start gap-2 text-[12px] font-semibold text-soft-black/50">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
          Saved per account. New renders pick up these settings automatically.
        </p>
      </aside>
    </div>
  );
}
