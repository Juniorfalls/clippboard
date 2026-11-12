"use client";

import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown, UsersRound } from "lucide-react";
import { cn } from "@/lib/utils";

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const PERSONAL_WORKSPACE = "personal";

export function TeamSwitcher() {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold uppercase tracking-wide text-soft-black/50">
        Workspace
      </span>
      <Select.Root value={PERSONAL_WORKSPACE}>
        <Select.Trigger
          aria-label="Current workspace"
          className={cn(
            "inline-flex w-full items-center justify-between gap-2 rounded-lg border border-border-gray bg-white px-3 py-2.5",
            "text-left text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
            "data-[state=open]:border-brand-blue",
            focusRing
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            <UsersRound className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
            <Select.Value />
          </span>
          <Select.Icon>
            <ChevronDown className="h-4 w-4 shrink-0 text-soft-black/60" aria-hidden />
          </Select.Icon>
        </Select.Trigger>

        <Select.Portal>
          <Select.Content
            position="popper"
            sideOffset={6}
            className="z-50 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-xl border border-border-gray bg-white shadow-xl"
          >
            <Select.Viewport className="p-1">
              <Select.Item
                value={PERSONAL_WORKSPACE}
                className={cn(
                  "relative flex cursor-pointer select-none items-center gap-2 rounded-lg py-3 pl-9 pr-8 text-[14px] text-soft-black",
                  "data-[highlighted]:bg-warm-white data-[state=checked]:font-semibold",
                  focusRing
                )}
              >
                <Select.ItemIndicator className="absolute left-3 text-brand-blue">
                  <Check className="h-4 w-4" aria-hidden />
                </Select.ItemIndicator>
                <Select.ItemText>Personal Workspace</Select.ItemText>
              </Select.Item>
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>
    </div>
  );
}
