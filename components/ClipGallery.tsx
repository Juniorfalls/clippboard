"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { ClipCard, downloadClip } from "@/components/ClipCard";
import { cn } from "@/lib/utils";
import type { Clip } from "@/types/video";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function ClipGallery({
  clips,
  progressById,
}: {
  clips: Clip[];
  progressById: Record<string, number>;
}) {
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);
  const completedClips = clips.filter(
    (clip) => clip.status === "completed" && Boolean(clip.url)
  );
  const canDownloadAll = completedClips.length > 0 && !isDownloadingAll;

  async function handleDownloadAll() {
    if (completedClips.length === 0) return;

    setIsDownloadingAll(true);
    toast.success("Download started", {
      description: `Preparing ${completedClips.length} completed clip${
        completedClips.length === 1 ? "" : "s"
      }.`,
    });

    let failedCount = 0;

    for (let i = 0; i < completedClips.length; i += 1) {
      const downloaded = await downloadClip(completedClips[i], { silent: true });
      if (!downloaded) failedCount += 1;

      if (i < completedClips.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (failedCount > 0) {
      toast.error("Some downloads failed", {
        description: `${failedCount} of ${completedClips.length} clips could not be downloaded.`,
      });
    }

    setIsDownloadingAll(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void handleDownloadAll()}
          disabled={!canDownloadAll}
          aria-label="Download all completed clips"
          className={cn(
            "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
            focusRing,
            "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60"
          )}
        >
          <Download className="h-4 w-4" aria-hidden />
          {isDownloadingAll ? "Downloading..." : "Download All"}
        </button>
      </div>

      <ul className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {clips.map((clip, i) => (
          <li key={clip.id} className="mx-auto w-full max-w-sm xs:max-w-none">
            <ClipCard clip={clip} index={i} progress={progressById[clip.id] ?? 0} />
          </li>
        ))}
      </ul>
    </div>
  );
}
