"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/utils/supabase/client";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

type VideoJob = {
  id: string;
  source_name: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  queued: "Queued",
  processing: "Processing",
  waiting_for_ai: "Waiting for AI",
  completed: "Completed",
  failed: "Failed",
};

const STATUS_STYLES: Record<string, string> = {
  queued: "border-border-gray bg-warm-white text-soft-black/70",
  processing: "border-brand-blue-light bg-brand-blue-light/60 text-soft-black",
  waiting_for_ai: "border-amber-200 bg-amber-50 text-amber-700",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  failed: "border-red-200 bg-red-50 text-red-700",
};

export default function ProjectsPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [jobToDelete, setJobToDelete] = useState<VideoJob | null>(null);
  const [jobToRename, setJobToRename] = useState<VideoJob | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Sign in to view your projects.");
        }

        const { data, error } = await supabase
          .from("video_jobs")
          .select("id, source_name, status, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (cancelled) return;

        setJobs((data ?? []) as VideoJob[]);
      } catch (error) {
        if (cancelled) return;
        console.error("[projects] Could not load video jobs", error);
        toast.error("Could not load projects", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, []);

  function openRenameModal(job: VideoJob) {
    setJobToRename(job);
    setRenameValue(job.source_name ?? "");
  }

  async function handleRenameProject() {
    if (!jobToRename || isRenaming) return;
    const nextName = renameValue.trim();

    if (!nextName) {
      toast.error("Project name is required.");
      return;
    }

    setIsRenaming(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("video_jobs")
        .update({ source_name: nextName })
        .eq("id", jobToRename.id);

      if (error) throw error;

      setJobs((previous) =>
        previous.map((job) =>
          job.id === jobToRename.id ? { ...job, source_name: nextName } : job
        )
      );
      setJobToRename(null);
      toast.success("Project renamed successfully.");
    } catch (error) {
      console.error("[projects] Could not rename project", error);
      toast.error("Could not rename project", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsRenaming(false);
    }
  }

  async function handleDeleteProject() {
    if (!jobToDelete || isDeleting) return;

    setIsDeleting(true);

    try {
      const supabase = createClient();
      const { error: clipsError } = await supabase
        .from("clips")
        .delete()
        .eq("job_id", jobToDelete.id);

      if (clipsError) throw clipsError;

      const { error: jobError } = await supabase
        .from("video_jobs")
        .delete()
        .eq("id", jobToDelete.id);

      if (jobError) throw jobError;

      setJobs((previous) =>
        previous.filter((job) => job.id !== jobToDelete.id)
      );
      setJobToDelete(null);
      toast.success("Project deleted successfully.");
    } catch (error) {
      console.error("[projects] Could not delete project", error);
      toast.error("Could not delete project", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
          Projects
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Every video you process becomes a project, ready for clips, captions,
          and exports.
        </p>
      </header>

      {isLoading ? (
        <section className="flex min-h-[280px] items-center justify-center rounded-3 border border-border-gray bg-white">
          <span className="flex items-center gap-2 text-[14px] font-semibold text-soft-black/60">
            <Loader2 className="h-4 w-4 animate-spin text-brand-blue" aria-hidden />
            Loading projects...
          </span>
        </section>
      ) : jobs.length === 0 ? (
        <section className="flex flex-col items-center rounded-3 border border-dashed border-border-gray bg-white px-6 py-16 text-center sm:py-20">
          <span className="flex h-16 w-16 items-center justify-center rounded-3 bg-brand-blue-light text-brand-blue">
            <FolderOpen className="h-8 w-8" aria-hidden />
          </span>
          <h2 className="mt-6 text-[28px] font-bold leading-[1.25]">
            No projects yet
          </h2>
          <p className="mt-2 max-w-md text-[16px] leading-relaxed text-soft-black/60">
            Upload a long-form video in the workspace to create your first
            project. Its clips will stay organized here.
          </p>
          <Link
            href="/dashboard"
            className={cn(
              "mt-7 inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
              focusRing
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Create a New Project
          </Link>
        </section>
      ) : (
        <section aria-label="Your projects">
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => {
              const status = STATUS_LABELS[job.status] ?? job.status;
              const statusStyle =
                STATUS_STYLES[job.status] ?? STATUS_STYLES.queued;
              const created = new Date(job.created_at);

              return (
                <li key={job.id}>
                  <article
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/dashboard/projects/${job.id}`)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(`/dashboard/projects/${job.id}`);
                      }
                    }}
                    className={cn(
                      "flex h-full cursor-pointer flex-col gap-5 rounded-3 border border-gray-200 bg-white p-5 duration-200 hover:border-brand-blue-light hover:shadow-md",
                      focusRing
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2 bg-brand-blue-light text-brand-blue">
                        <FolderOpen className="h-5 w-5" aria-hidden />
                      </span>
                      <div
                        className="flex items-center gap-2"
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                      >
                        <span
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                            statusStyle
                          )}
                        >
                          {status}
                        </span>
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button
                              type="button"
                              aria-label={`Project options for ${job.source_name || "Untitled video"}`}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 duration-200 hover:bg-warm-white hover:text-soft-black",
                                focusRing
                              )}
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content
                              align="end"
                              sideOffset={6}
                              className="z-50 min-w-[180px] overflow-hidden rounded-xl border border-border-gray bg-white p-1 shadow-xl"
                            >
                              <DropdownMenu.Item
                                onSelect={() => openRenameModal(job)}
                                className={cn(
                                  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-soft-black outline-none duration-200",
                                  "data-[highlighted]:bg-warm-white",
                                  "focus-visible:ring-2 focus-visible:ring-brand-blue"
                                )}
                              >
                                <Pencil className="h-4 w-4 text-brand-blue" aria-hidden />
                                Rename
                              </DropdownMenu.Item>
                              <DropdownMenu.Item
                                onSelect={() => setJobToDelete(job)}
                                className={cn(
                                  "flex cursor-pointer select-none items-center gap-2 rounded-lg px-3 py-2.5 text-[14px] font-semibold text-red-600 outline-none duration-200",
                                  "data-[highlighted]:bg-red-50",
                                  "focus-visible:ring-2 focus-visible:ring-red-500"
                                )}
                              >
                                <Trash2 className="h-4 w-4" aria-hidden />
                                Delete
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-[18px] font-bold leading-[1.3] text-soft-black">
                        {job.source_name || "Untitled video"}
                      </h2>
                      <p className="mt-1 text-[13px] font-medium text-soft-black/50">
                        {Number.isNaN(created.getTime())
                          ? "Unknown date"
                          : created.toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                      </p>
                    </div>
                  </article>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Dialog.Root
        open={Boolean(jobToRename)}
        onOpenChange={(open) => {
          if (!open && !isRenaming) setJobToRename(null);
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
              Rename project
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-soft-black/60">
              Give this project a name that is easy to find later.
            </Dialog.Description>

            <label
              htmlFor="project-name"
              className="mt-6 block text-[12px] font-bold uppercase tracking-wide text-soft-black/50"
            >
              Project name
            </label>
            <input
              id="project-name"
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleRenameProject();
                }
              }}
              maxLength={240}
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
                onClick={() => void handleRenameProject()}
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
        open={Boolean(jobToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setJobToDelete(null);
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
                  aria-label="Close delete confirmation"
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
              Delete this project?
            </Dialog.Title>
            <Dialog.Description className="mt-2 text-[14px] leading-relaxed text-soft-black/60">
              Are you sure you want to delete{" "}
              <span className="font-semibold text-soft-black">
                {jobToDelete?.source_name || "this project"}
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
                onClick={() => void handleDeleteProject()}
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
                {isDeleting ? "Deleting..." : "Delete project"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
