import Link from "next/link";
import { FolderOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export default function ProjectsPage() {
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
    </div>
  );
}
