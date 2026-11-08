"use client";

import { useState } from "react";
import { Clapperboard } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/CustomSelect";
import { CustomDropzone } from "@/components/CustomDropzone";
import { CustomTextArea } from "@/components/CustomTextArea";
import { ClipSkeleton } from "@/components/ClipSkeleton";
import { ClipGallery } from "@/components/ClipGallery";
import { getAIAnalyzer } from "@/services/ai";
import { getVideoProcessor } from "@/services/video";
import { extractAudio } from "@/lib/extract-audio";
import { cn } from "@/lib/utils";
import type { Clip, ProcessingOptions } from "@/types/video";

const FORMATS = [
  { value: "9:16", label: "TikTok 9:16" },
  { value: "16:9", label: "Landscape 16:9" },
  { value: "1:1", label: "Square 1:1" },
];

const RESOLUTIONS = [
  { value: "1080p", label: "1080p" },
  { value: "4K", label: "4K Upscale" },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function WorkspaceDashboard() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("Find the 10 best moments from this video.");
  const [overlayText, setOverlayText] = useState("");
  const [format, setFormat] = useState<ProcessingOptions["targetAspectRatio"]>("9:16");
  const [resolution, setResolution] =
    useState<ProcessingOptions["resolution"]>("1080p");
  const [isProcessing, setIsProcessing] = useState(false);
  const [clips, setClips] = useState<Clip[]>([]);
  const [progressById, setProgressById] = useState<Record<string, number>>({});

  function updateClip(id: string, patch: Partial<Clip>) {
    setClips((previous) =>
      previous.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip))
    );
  }

  async function handleGenerate() {
    if (!uploadedFile) {
      toast.error("Add a video first", {
        description: "Drop a raw video above to generate clips.",
      });
      return;
    }

    setIsProcessing(true);
    setClips([]);
    setProgressById({});

    const statusToastId = "analysis-status";
    toast.loading("Extracting audio...", { id: statusToastId });

    try {
      const audioFile = await extractAudio(uploadedFile, (progress) => {
        toast.loading("Extracting audio...", {
          id: statusToastId,
          description: `${Math.round(progress * 100)}% complete`,
        });
      });

      toast.loading("Transcribing audio...", {
        id: statusToastId,
        description: "Sending the audio track to Whisper.",
      });

      const analyzer = getAIAnalyzer();
      const analysis = await analyzer.analyze(audioFile, prompt);

      if (analysis.clips.length === 0) {
        throw new Error("No memorable moments were found in this video.");
      }

      if (analysis.clips.length !== 10) {
        throw new Error("The AI did not return 10 clips. Please try again.");
      }

      setClips(analysis.clips);
      toast.dismiss(statusToastId);

      const processor = getVideoProcessor();
      const options: ProcessingOptions = {
        targetAspectRatio: format,
        resolution,
        animationText: overlayText,
        animationStyle: "single-line",
      };

      let failedCount = 0;

      for (const clip of analysis.clips) {
        updateClip(clip.id, { status: "processing" });
        setProgressById((previous) => ({ ...previous, [clip.id]: 0 }));

        try {
          const url = await processor.processClip(
            uploadedFile,
            clip,
            options,
            (progress) => {
              const rounded = Math.round(progress);
              setProgressById((previous) => ({
                ...previous,
                [clip.id]: rounded,
              }));
            }
          );

          setProgressById((previous) => ({ ...previous, [clip.id]: 100 }));
          updateClip(clip.id, { status: "completed", url });
        } catch (error) {
          failedCount += 1;
          updateClip(clip.id, { status: "error" });
          toast.error(`Could not render ${clip.title}`, {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
        }
      }

      if (failedCount === 0) {
        toast.success("All 10 clips generated successfully!");
      } else {
        toast.error("Some clips could not be generated", {
          description: `${failedCount} of ${analysis.clips.length} clips failed.`,
        });
      }
    } catch (error) {
      toast.dismiss(statusToastId);
      toast.error("Could not generate clips", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setIsProcessing(false);
      toast.dismiss(statusToastId);
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
            Workspace
          </h1>
          <span
            className={cn(
              "inline-flex items-center gap-2 rounded-full border border-border-gray bg-white px-3 py-1.5 text-[12px] font-semibold text-soft-black/70",
              isProcessing && "border-brand-blue-light text-soft-black"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "h-2 w-2 rounded-full bg-brand-blue",
                isProcessing && "animate-pulse"
              )}
            />
            Browser-based processing · Keep tab open
          </span>
        </div>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Upload a raw video and Clippboard finds the 10 best moments, reframes
          them for TikTok and upscales to 4K.
        </p>
      </header>

      <section aria-label="Create clips" className="flex flex-col gap-6">
        <CustomDropzone
          file={uploadedFile}
          onFileChange={setUploadedFile}
          disabled={isProcessing}
        />

        <div className="grid gap-5 rounded-2xl border border-border-gray bg-white p-5 md:grid-cols-2 md:p-6">
          <CustomTextArea
            label="What should Clippboard find?"
            value={prompt}
            onChange={setPrompt}
            placeholder="Find the best 10 moments. Add the text 'Subscribe for more'..."
            hint="Describe the moments and style you want the AI to look for."
            maxLength={240}
            rows={4}
            disabled={isProcessing}
          />
          <CustomTextArea
            label="On-screen text"
            value={overlayText}
            onChange={setOverlayText}
            placeholder="Subscribe for more!"
            hint="Shown once on each clip as a single-line animation. Leave empty for none."
            maxLength={80}
            rows={4}
            disabled={isProcessing}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <CustomSelect
            label="Target format"
            value={format}
            onValueChange={(value) =>
              setFormat(value as ProcessingOptions["targetAspectRatio"])
            }
            options={FORMATS}
          />
          <CustomSelect
            label="Resolution"
            value={resolution}
            onValueChange={(value) =>
              setResolution(value as ProcessingOptions["resolution"])
            }
            options={RESOLUTIONS}
          />
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isProcessing}
            aria-busy={isProcessing}
            className={cn(
              "inline-flex items-center justify-center rounded-xl bg-brand-blue px-8 py-3 text-[16px] font-semibold text-soft-black duration-200",
              "hover:bg-brand-blue-hover",
              focusRing,
              "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60 md:ml-auto"
            )}
          >
            {isProcessing ? "Generating clips" : "Generate 10 Clips"}
          </button>
        </div>
      </section>

      <section
        aria-label="Clips"
        aria-live="polite"
        aria-busy={isProcessing}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[24px] font-bold leading-[1.25]">Your clips</h2>
          {isProcessing && (
            <p className="text-[14px] font-semibold text-soft-black/60">
              Browser rendering in progress. Please keep tab open.
            </p>
          )}
        </div>

        {isProcessing && clips.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <ClipSkeleton key={i} className="mx-auto w-full max-w-sm xs:max-w-none" />
            ))}
          </div>
        ) : clips.length > 0 ? (
          <ClipGallery clips={clips} progressById={progressById} />
        ) : (
          <div className="relative flex flex-col items-center overflow-hidden rounded-3 border border-dashed border-border-gray bg-white px-6 py-16 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-brand-blue-light/70 to-transparent"
            />
            <span className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-brand-blue-light bg-white text-brand-blue">
              <Clapperboard className="h-8 w-8" aria-hidden />
            </span>
            <h3 className="relative text-[20px] font-bold leading-[1.25]">
              {uploadedFile ? "Ready when you are" : "No clips yet"}
            </h3>
            <p className="relative mt-2 max-w-sm text-[16px] text-soft-black/60">
              {uploadedFile
                ? "Your video is ready. Hit Generate 10 Clips and we will find the moments worth sharing."
                : "Upload a video and hit Generate. We will find your 10 best moments and turn them into shareable clips."}
            </p>
            <p className="relative mt-5 text-[12px] font-semibold text-soft-black/40">
              Browser-based processing · Keep tab open during export
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
