"use client";

import { useCallback } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import { FileVideo, UploadCloud, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB

type CustomDropzoneProps = {
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
  className?: string;
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

function formatSize(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

export function CustomDropzone({
  file,
  onFileChange,
  disabled,
  className,
}: CustomDropzoneProps) {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const code = rejected[0].errors[0]?.code;
        toast.error(
          code === "file-too-large"
            ? "That video is over 2 GB"
            : "Upload a video file (MP4, MOV or WebM)",
          { description: rejected[0].file.name }
        );
        return;
      }
      if (accepted[0]) {
        onFileChange(accepted[0]);
        toast.success("Video added", { description: accepted[0].name });
      }
    },
    [onFileChange]
  );

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    accept: { "video/*": [".mp4", ".mov", ".webm"] },
    maxSize: MAX_SIZE,
    multiple: false,
    noClick: true, // clicks go through our own button
    noKeyboard: true,
    disabled,
  });

  if (file) {
    return (
      <div
        className={cn(
          "flex items-center gap-4 rounded-2xl border border-border-gray bg-white p-5",
          className
        )}
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
          <FileVideo className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{file.name}</p>
          <p className="text-[14px] text-soft-black/60">{formatSize(file.size)}</p>
        </div>
        <button
          type="button"
          onClick={() => onFileChange(null)}
          disabled={disabled}
          aria-label="Remove video"
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-lg text-soft-black/60 duration-200 hover:bg-warm-white hover:text-soft-black disabled:opacity-50",
            focusRing
          )}
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div
      {...getRootProps()}
      className={cn(
        "flex flex-col items-center rounded-2xl border-2 border-dashed p-10 text-center duration-200 md:p-12",
        isDragActive
          ? "border-brand-blue bg-brand-blue/10"
          : "border-gray-300 bg-warm-white",
        disabled && "pointer-events-none opacity-60",
        className
      )}
    >
      {/* Native input stays in the DOM for the drop API but is never visible */}
      <input {...getInputProps()} className="absolute opacity-0" tabIndex={-1} />

      <UploadCloud
        className={cn("mb-4 h-10 w-10", isDragActive ? "text-brand-blue" : "text-soft-black/50")}
        aria-hidden
      />
      <p className="text-[16px] font-semibold">
        {isDragActive
          ? "Drop to upload"
          : "Drag & drop your raw video, or click to browse"}
      </p>
      <p className="mt-1 text-[14px] text-soft-black/60">MP4, MOV or WebM, up to 2 GB</p>
      <button
        type="button"
        onClick={open}
        className={cn(
          "mt-6 inline-flex items-center justify-center rounded-2 bg-brand-blue px-4 py-3 font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover xs:rounded-3",
          focusRing
        )}
      >
        Choose video
      </button>
    </div>
  );
}
