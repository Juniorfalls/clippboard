"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/CustomSelect";
import { CustomDropzone } from "@/components/CustomDropzone";
import { CustomTextArea } from "@/components/CustomTextArea";
import { ClipSkeleton } from "@/components/ClipSkeleton";
import { ClipGallery } from "@/components/ClipGallery";
import { cn } from "@/lib/utils";
import type { ApiError, Clip, GenerateClipsResponse } from "@/lib/types";

const FORMATS = [
  { value: "tiktok-9-16", label: "TikTok 9:16" },
  { value: "landscape-16-9", label: "Landscape 16:9" },
];
const RESOLUTIONS = [
  { value: "1080p", label: "1080p" },
  { value: "4k", label: "4K Upscale" },
];

export default function WorkspacePage() {
  const [file, setFile] = useState<File | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [format, setFormat] = useState("tiktok-9-16");
  const [resolution, setResolution] = useState("4k");
  const [isGenerating, setIsGenerating] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);

  async function handleGenerate() {
    if (!file) {
      toast.error("Add a video first", {
        description: "Drop a raw video above to generate clips.",
      });
      return;
    }
    setIsGenerating(true);
    setClips([]);
    try {
      const body = new FormData();
      body.append("file", file);
      body.append("overlayText", overlayText);
      body.append("format", format);
      body.append("resolution", resolution);

      const res = await fetch("/api/generate-clips", { method: "POST", body });
      const data: GenerateClipsResponse | ApiError = await res.json();
      if (!res.ok || "error" in data) {
        throw new Error("error" in data ? data.error : "Something went wrong.");
      }
      setClips(data.clips);
      toast.success(`${data.clips.length} clips are ready`);
    } catch (err) {
      toast.error("Could not generate clips", {
        description: err instanceof Error ? err.message : "Try again in a moment.",
      });
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
          Workspace
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Upload a raw video and Clippboard finds the 10 best moments, reframes
          them for TikTok and upscales to 4K.
        </p>
      </header>

      <section aria-label="Create clips" className="flex flex-col gap-6">
        <CustomDropzone file={file} onFileChange={setFile} disabled={isGenerating} />

        <div className="rounded-2xl border border-border-gray bg-white p-5 md:p-6">
          <CustomTextArea
            label="On-screen text"
            value={overlayText}
            onChange={setOverlayText}
            placeholder="Subscribe for more!"
            hint="Shown once on each clip as a single-line animation. Leave empty for none."
            maxLength={80}
            rows={2}
            disabled={isGenerating}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <CustomSelect
            label="Target format"
            value={format}
            onValueChange={setFormat}
            options={FORMATS}
          />
          <CustomSelect
            label="Resolution"
            value={resolution}
            onValueChange={setResolution}
            options={RESOLUTIONS}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            aria-busy={isGenerating}
            className={cn(
              "inline-flex items-center justify-center rounded-xl bg-brand-blue px-8 py-3 text-[16px] font-semibold text-soft-black duration-200",
              "hover:bg-brand-blue-hover outline-none focus-visible:ring-2 focus-visible:ring-blue-500",
              "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60 md:ml-auto"
            )}
          >
            {isGenerating ? "Generating clips" : "Generate 10 Clips"}
          </button>
        </div>
      </section>

      <section aria-label="Clips" aria-live="polite" className="flex flex-col gap-4">
        <h2 className="text-[24px] font-bold leading-[1.25]">Your clips</h2>
        {isGenerating ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <ClipSkeleton key={i} />
            ))}
          </div>
        ) : clips.length > 0 ? (
          <ClipGallery clips={clips} />
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-gray-300 px-6 py-12 text-center">
            <p className="text-[16px] font-semibold">No clips yet</p>
            <p className="mt-1 text-[14px] text-soft-black/60">
              Add a video and select Generate 10 Clips to see results here.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
