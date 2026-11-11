"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FolderOpen, Loader2, Plus } from "lucide-react";
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
  const [jobs, setJobs] = useState<VideoJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
                  <article className="flex h-full flex-col gap-5 rounded-3 border border-gray-200 bg-white p-5">
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2 bg-brand-blue-light text-brand-blue">
                        <FolderOpen className="h-5 w-5" aria-hidden />
                      </span>
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] font-bold",
                          statusStyle
                        )}
                      >
                        {status}
                      </span>
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
    </div>
  );
}
