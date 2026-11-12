"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import {
  AlertTriangle,
  ArrowLeft,
  Film,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { ClipCard } from "@/components/ClipCard";
import type { PublishPayload } from "@/components/PublishModal";
import { normalizePlan, type Plan } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";
import type { Clip, TranscriptSegment } from "@/types/video";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

type ProjectJob = {
  id: string;
  source_name: string | null;
  status: string;
  created_at: string;
  transcript: TranscriptSegment[] | null;
};

type ProjectClipRow = {
  id: string;
  title: string;
  duration: number | null;
  engagement_score: number | null;
  start_time: number | null;
  end_time: number | null;
  hook_text: string | null;
  virality_reason: string | null;
  metadata: Partial<Clip> | null;
  video_url: string | null;
  thumbnail_url?: string | null;
  status: string | null;
};

function storedClipStatus(
  status: string | null | undefined,
  videoUrl: string | null | undefined
): Clip["status"] {
  if (status === "scheduled" && videoUrl) return "scheduled";
  if (status === "error" || !videoUrl) return "error";
  return "completed";
}

export default function ProjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [job, setJob] = useState<ProjectJob | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [plan, setPlan] = useState<Plan>("starter");
  const [userId, setUserId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [clipToRename, setClipToRename] = useState<Clip | null>(null);
  const [clipToDelete, setClipToDelete] = useState<Clip | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProject() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error("Sign in to view this project.");
        if (!cancelled) setUserId(user.id);

        const { data: jobData, error: jobError } = await supabase
          .from("video_jobs")
          .select("id, source_name, status, created_at, transcript")
          .eq("id", params.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (jobError) throw jobError;
        if (!jobData) throw new Error("This project could not be found.");

        const { data: clipRows, error: clipsError } = await supabase
          .from("clips")
          .select(
            "id, title, duration, engagement_score, start_time, end_time, hook_text, virality_reason, metadata, video_url, thumbnail_url, status"
          )
          .eq("job_id", params.id)
          .eq("user_id", user.id)
          .order("engagement_score", { ascending: false });

        if (clipsError) throw clipsError;

        const { data: profile } = await supabase
          .from("profiles")
          .select("plan")
          .eq("id", user.id)
          .maybeSingle();

        if (cancelled) return;

        setJob(jobData as ProjectJob);
        setPlan(normalizePlan(profile?.plan));
        setClips(
          ((clipRows ?? []) as ProjectClipRow[]).map((row) => {
            const metadata = row.metadata ?? {};
            const videoUrl =
              typeof row.video_url === "string" && row.video_url.length > 0
                ? row.video_url
                : undefined;

            return {
              ...metadata,
              id: row.id,
              title: row.title || metadata.title || "Untitled clip",
              duration: Number(row.duration ?? metadata.duration ?? 0),
              engagementScore: Number(
                row.engagement_score ?? metadata.engagementScore ?? 0
              ),
              startTime: Number(row.start_time ?? metadata.startTime ?? 0),
              endTime: Number(row.end_time ?? metadata.endTime ?? 0),
              hookText: row.hook_text ?? metadata.hookText ?? "",
              viralityReason:
                row.virality_reason ?? metadata.viralityReason ?? "",
              status: storedClipStatus(row.status, videoUrl),
              url: videoUrl,
              storageUrl: videoUrl,
              thumbnailUrl:
                typeof row.thumbnail_url === "string" &&
                row.thumbnail_url.length > 0
                  ? row.thumbnail_url
                  : undefined,
            } satisfies Clip;
          })
        );
      } catch (error) {
        if (cancelled) return;
        console.error("[project] Could not load project", error);
        setLoadError(
          error instanceof Error ? error.message : "Please try again."
        );
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadProject();

    return () => {
      cancelled = true;
    };
  }, [params.id]);

  function openRenameModal(clip: Clip) {
    setClipToRename(clip);
    setRenameValue(clip.title);
  }

  async function handleRenameClip() {
    if (!clipToRename || isRenaming) return;
    const nextTitle = renameValue.trim();

    if (!nextTitle) {
      toast.error("Clip name is required.");
      return;
    }

    setIsRenaming(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("clips")
        .update({ title: nextTitle })
        .eq("id", clipToRename.id)
        .eq("user_id", userId);

      if (error) throw error;

      setClips((previous) =>
        previous.map((clip) =>
          clip.id === clipToRename.id ? { ...clip, title: nextTitle } : clip
        )
      );
      setClipToRename(null);
      toast.success("Clip renamed successfully.");
    } catch (error) {
      console.error("[project] Could not rename clip", error);
      toast.error("Could not rename clip", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleDeleteClip() {
    if (!clipToDelete || isDeleting) return;
    setIsDeleting(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("clips")
        .delete()
        .eq("id", clipToDelete.id)
        .eq("user_id", userId);

      if (error) throw error;

      setClips((previous) =>
        previous.filter((clip) => clip.id !== clipToDelete.id)
      );
      setClipToDelete(null);
      toast.success("Clip deleted successfully.");
    } catch (error) {
      console.error("[project] Could not delete clip", error);
      toast.error("Could not delete clip", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  function handleScheduled(clip: Clip, payload: PublishPayload) {
    setClips((previous) =>
      previous.map((item) =>
        item.id === clip.id
          ? {
              ...item,
              status: "scheduled",
              scheduledFor: payload.scheduledFor,
              publishPlatforms: payload.platforms,
            }
          : item
      )
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/dashboard/projects"
          className={cn(
            "inline-flex items-center gap-2 rounded-2 border border-border-gray bg-white px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
            focusRing
          )}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to Projects
        </Link>
      </div>

      <header className="flex flex-col gap-3">
        <span className="inline-flex items-center gap-2 text-[12px] font-bold uppercase tracking-wide text-brand-blue">
          <Film className="h-4 w-4" aria-hidden />
          Project folder
        </span>
        <h1 className="break-words text-[36px] font-bold leading-[1.05] -tracking-1 md:text-[44px]">
          {job?.source_name || "Project clips"}
        </h1>
        <p className="text-[15px] text-soft-black/60">
          {job
            ? `${clips.length} clip${clips.length === 1 ? "" : "s"} in this project`
            : "Loading your clips..."}
        </p>
      </header>

      {isLoading ? (
        <section className="flex min-h-[320px] items-center justify-center rounded-3 border border-border-gray bg-white">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-soft-black/60">
            <Loader2 className="h-4 w-4 animate-spin text-brand-blue" aria-hidden />
            Loading project clips...
          </span>
        </section>
      ) : loadError ? (
        <section className="flex flex-col items-center rounded-3 border border-red-200 bg-red-50 px-6 py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-red-500" aria-hidden />
          <h2 className="mt-4 text-[24px] font-bold">Could not open project</h2>
          <p className="mt-2 max-w-md text-[14px] text-red-700/70">
            {loadError}
          </p>
        </section>
      ) : clips.length === 0 ? (
        <section className="flex flex-col items-center rounded-3 border border-dashed border-border-gray bg-white px-6 py-16 text-center">
          <Film className="h-8 w-8 text-brand-blue" aria-hidden />
          <h2 className="mt-4 text-[24px] font-bold">No clips in this folder</h2>
          <p className="mt-2 max-w-md text-[14px] text-soft-black/60">
            Generate clips in the workspace to add them to this project.
          </p>
          <Link
            href="/dashboard"
            className={cn(
              "mt-6 inline-flex items-center justify-center rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
              focusRing
            )}
          >
            Go to Workspace
          </Link>
        </section>
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {clips.map((clip, index) => (
            <li key={clip.id} className="w-full">
              <ClipCard
                clip={clip}
                index={index}
                progress={0}
                onSchedule={handleScheduled}
                onRename={openRenameModal}
                onDelete={setClipToDelete}
                transcript={job?.transcript ?? []}
                plan={plan}
                userId={userId}
              />
            </li>
          ))}
        </ul>
      )}

      <Dialog.Root
        open={Boolean(clipToRename)}
        onOpenChange={(open) => {
          if (!open && !isRenaming) setClipToRename(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-soft-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3 border border-border-gray bg-white p-6 shadow-xl",
              focusRing
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2 bg-brand-blue-light text-brand-blue">
                <Pencil className="h-6 w-6" aria-hidden />
              </span>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close rename dialog"
                  disabled={isRenaming}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border border-border-gray bg-warm-white text-soft-black duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
                    focusRing
                  )}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Title className="mt-5 text-[24px] font-bold leading-[1.25] text-soft-black">
              Rename clip
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-soft-black/60">
              Choose a clear title for this clip.
            </Dialog.Description>
            <label
              htmlFor="clip-name"
              className="mt-6 block text-[12px] font-bold uppercase tracking-wide text-soft-black/50"
            >
              Clip name
            </label>
            <input
              id="clip-name"
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRenameClip();
                }
              }}
              maxLength={120}
              autoFocus
              className={cn(
                "mt-2 w-full rounded-2 border border-border-gray bg-white px-4 py-3 text-[15px] font-semibold text-soft-black placeholder:text-soft-black/35",
                focusRing
              )}
            />
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isRenaming}
                  className={cn(
                    "inline-flex items-center justify-center rounded-2 border border-border-gray bg-white px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white disabled:cursor-not-allowed disabled:opacity-50",
                    focusRing
                  )}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void handleRenameClip()}
                disabled={isRenaming}
                aria-busy={isRenaming}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:opacity-60",
                  focusRing
                )}
              >
                {isRenaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Pencil className="h-4 w-4" aria-hidden />
                )}
                {isRenaming ? "Saving..." : "Save changes"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <Dialog.Root
        open={Boolean(clipToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setClipToDelete(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-soft-black/50 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-3 border border-border-gray bg-white p-6 shadow-xl",
              focusRing
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2 bg-red-50 text-red-600">
                <AlertTriangle className="h-6 w-6" aria-hidden />
              </span>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Close delete dialog"
                  disabled={isDeleting}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full border border-border-gray bg-warm-white text-soft-black duration-200 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50",
                    focusRing
                  )}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <Dialog.Title className="mt-5 text-[24px] font-bold leading-[1.25] text-soft-black">
              Delete this clip?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-soft-black/60">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-soft-black">
                {clipToDelete?.title || "this clip"}
              </span>
              ? This action cannot be undone.
            </Dialog.Description>
            <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isDeleting}
                  className={cn(
                    "inline-flex items-center justify-center rounded-2 border border-border-gray bg-white px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white disabled:cursor-not-allowed disabled:opacity-50",
                    focusRing
                  )}
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void handleDeleteClip()}
                disabled={isDeleting}
                aria-busy={isDeleting}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-2 bg-red-600 px-5 py-2.5 text-[14px] font-semibold text-white duration-200 hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60",
                  focusRing
                )}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                {isDeleting ? "Deleting..." : "Delete clip"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
