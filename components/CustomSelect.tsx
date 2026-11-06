"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { value: string; label: string };

type CustomSelectProps = {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

export function CustomSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Select",
  className,
}: CustomSelectProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[14px] font-semibold text-soft-black">{label}</span>
      <Select.Root value={value} onValueChange={onValueChange}>
        <Select.Trigger
          aria-label={label}
          className={cn(
            "inline-flex min-w-[200px] items-center justify-between gap-3 rounded-lg border border-border-gray bg-white px-4 py-3",
            "text-[16px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
            "data-[state=open]:border-brand-blue",
            focusRing
          )}
        >
          <Select.Value placeholder={placeholder} />
          <Select.Icon>
            <ChevronDown className="h-4 w-4 text-soft-black/60" aria-hidden />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className={cn(
              "z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border-gray bg-white shadow-xl",
              "data-[state=open]:animate-select-in data-[state=closed]:animate-select-out"
            )}
          >
            <Select.Viewport className="no-scrollbar p-1">
              {options.map((opt) => (
                <Select.Item
                  key={opt.value}
                  value={opt.value}
                  className={cn(
                    "relative flex cursor-pointer select-none items-center rounded-lg py-3 pl-9 pr-8 text-[16px] text-soft-black",
                    "data-[highlighted]:bg-warm-white data-[state=checked]:font-semibold",
                    "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue"
                  )}
                >
                  <Select.ItemIndicator className="absolute left-3 text-brand-blue">
                    <Check className="h-4 w-4" aria-hidden />
                  </Select.ItemIndicator>
                  <Select.ItemText>{opt.label}</Select.ItemText>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
