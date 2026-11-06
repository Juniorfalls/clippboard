"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type CustomTextAreaProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
  rows?: number;
  disabled?: boolean;
  className?: string;
};

export function CustomTextArea({
  label,
  value,
  onChange,
  placeholder,
  hint,
  maxLength = 80,
  rows = 3,
  disabled,
  className,
}: CustomTextAreaProps) {
  const id = useId();
  const hintId = `${id}-hint`;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-[14px] font-semibold text-soft-black">
        {label}
      </label>
      <div className="relative">
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          className={cn(
            // resize-none removes the native drag handle; no-scrollbar hides the native bar
            "no-scrollbar block w-full resize-none rounded-2xl border border-border-gray bg-white px-5 py-4 pb-9 text-[16px] text-soft-black",
            "placeholder:text-soft-black/40 duration-200 disabled:opacity-60",
            "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
          )}
        />
        <span
          className="pointer-events-none absolute bottom-3 right-4 text-[12px] text-soft-black/50"
          aria-hidden
        >
          {value.length}/{maxLength}
        </span>
      </div>
      {hint && (
        <p id={hintId} className="text-[14px] text-soft-black/60">
          {hint}
        </p>
      )}
    </div>
  );
}
