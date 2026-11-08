"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Music2,
  Send,
  X,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Clip } from "@/types/video";

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const PLATFORMS: {
  id: "tiktok" | "youtube";
  label: string;
  icon: LucideIcon;
}[] = [
  { id: "tiktok", label: "TikTok", icon: Music2 },
  { id: "youtube", label: "YouTube Shorts", icon: Youtube },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDefaultSchedule() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(9, 0, 0, 0);
  return date;
}

function formatSchedule(date: Date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export type PublishPayload = {
  scheduledFor: string;
  platforms: string[];
};

type PublishModalProps = {
  clip: Clip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScheduled: (clip: Clip, payload: PublishPayload) => void;
};

export function PublishModal({
  clip,
  open,
  onOpenChange,
  onScheduled,
}: PublishModalProps) {
  const [selectedDate, setSelectedDate] = useState(() =>
    startOfDay(getDefaultSchedule())
  );
  const [selectedTime, setSelectedTime] = useState("09:00");
  const [visibleMonth, setVisibleMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  );
  const [platforms, setPlatforms] = useState<Set<string>>(new Set());
  const [timeError, setTimeError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const next = getDefaultSchedule();
    setSelectedDate(startOfDay(next));
    setSelectedTime(
      `${String(next.getHours()).padStart(2, "0")}:${String(
        next.getMinutes()
      ).padStart(2, "0")}`
    );
    setVisibleMonth(new Date(next.getFullYear(), next.getMonth(), 1));
    setPlatforms(new Set());
    setTimeError("");
  }, [open]);

  const calendarCells = useMemo(() => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    return [
      ...Array.from({ length: firstWeekday }, () => null),
      ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
    ];
  }, [visibleMonth]);

  const today = startOfDay(new Date());
  const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoPrevious = visibleMonth.getTime() > currentMonth.getTime();
  const monthLabel = new Intl.DateTimeFormat(undefined, {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);

  const [hours, minutes] = TIME_PATTERN.test(selectedTime)
    ? selectedTime.split(":").map(Number)
    : [9, 0];
  const scheduledDate = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate(),
    hours,
    minutes,
    0,
    0
  );

  function togglePlatform(id: string) {
    setPlatforms((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function changeMonth(delta: number) {
    setVisibleMonth(
      (current) =>
        new Date(current.getFullYear(), current.getMonth() + delta, 1)
    );
  }

  async function handleSchedule() {
    if (platforms.size === 0) {
      toast.error("Choose a destination", {
        description: "Select TikTok or YouTube before scheduling.",
      });
      return;
    }

    if (!TIME_PATTERN.test(selectedTime)) {
      setTimeError("Use a 24-hour time such as 09:30.");
      toast.error("That time is not valid", {
        description: "Enter a time in HH:MM format.",
      });
      return;
    }

    if (scheduledDate.getTime() <= Date.now()) {
      toast.error("Choose a future time", {
        description: "Scheduled posts must be in the future.",
      });
      return;
    }

    setTimeError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clipId: clip.id,
          title: clip.title,
          scheduledFor: scheduledDate.toISOString(),
          platforms: Array.from(platforms),
        }),
      });

      if (!response.ok) {
        throw new Error("The scheduling service did not accept this post.");
      }

      onScheduled(clip, {
        scheduledFor: scheduledDate.toISOString(),
        platforms: Array.from(platforms),
      });
      toast.success("Post scheduled", {
        description: `${formatSchedule(scheduledDate)} · ${Array.from(
          platforms
        )
          .map((id) => PLATFORMS.find((platform) => platform.id === id)?.label)
          .filter(Boolean)
          .join(", ")}`,
      });
      onOpenChange(false);
    } catch (error) {
      toast.error("Could not schedule post", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-soft-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2",
            "max-h-[92vh] overflow-y-auto rounded-3 border border-border-gray bg-white p-5 shadow-xl md:p-6",
            focusRing
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-brand-blue">
                <Send className="h-4 w-4" aria-hidden />
                Publish clip
              </span>
              <Dialog.Title className="text-[24px] font-bold leading-[1.25]">
                Schedule your post
              </Dialog.Title>
              <Dialog.Description className="line-clamp-1 text-[14px] text-soft-black/60">
                {clip.title}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close publish modal"
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border-gray bg-warm-white text-soft-black duration-200 hover:bg-white",
                  focusRing
                )}
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-5 flex flex-col gap-2">
            <span className="text-[14px] font-semibold text-soft-black">
              Publish to
            </span>
            <div className="grid gap-3 sm:grid-cols-2">
              {PLATFORMS.map(({ id, label, icon: Icon }) => {
                const active = platforms.has(id);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => togglePlatform(id)}
                    className={cn(
                      "flex items-center gap-3 rounded-2 border px-4 py-3 text-left duration-200",
                      active
                        ? "border-brand-blue bg-brand-blue-light text-soft-black"
                        : "border-border-gray bg-white text-soft-black hover:bg-warm-white",
                      focusRing
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                        active
                          ? "bg-brand-blue text-soft-black"
                          : "bg-warm-white text-soft-black/70"
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-[14px] font-semibold">{label}</span>
                      <span className="text-[12px] text-soft-black/50">
                        {active ? "Selected for publishing" : "Tap to connect"}
                      </span>
                    </span>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-[1fr_220px]">
            <section className="rounded-2 border border-border-gray bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-2 text-[14px] font-semibold">
                  <CalendarDays className="h-4 w-4 text-brand-blue" aria-hidden />
                  {monthLabel}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeMonth(-1)}
                    disabled={!canGoPrevious}
                    aria-label="Previous month"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border border-border-gray bg-white text-soft-black duration-200 hover:bg-warm-white",
                      "disabled:cursor-not-allowed disabled:opacity-40",
                      focusRing
                    )}
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => changeMonth(1)}
                    aria-label="Next month"
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg border border-border-gray bg-white text-soft-black duration-200 hover:bg-warm-white",
                      focusRing
                    )}
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1 text-center">
                {WEEKDAYS.map((day) => (
                  <span
                    key={day}
                    className="py-1 text-[11px] font-semibold text-soft-black/40"
                  >
                    {day}
                  </span>
                ))}
                {calendarCells.map((day, index) => {
                  if (!day) {
                    return <span key={`empty-${index}`} />;
                  }

                  const date = new Date(
                    visibleMonth.getFullYear(),
                    visibleMonth.getMonth(),
                    day
                  );
                  const disabled = date < today;
                  const selected =
                    date.getTime() === selectedDate.getTime();
                  const isToday = date.getTime() === today.getTime();

                  return (
                    <button
                      key={`${visibleMonth.getFullYear()}-${visibleMonth.getMonth()}-${day}`}
                      type="button"
                      disabled={disabled}
                      aria-pressed={selected}
                      aria-label={new Intl.DateTimeFormat(undefined, {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      }).format(date)}
                      onClick={() => setSelectedDate(date)}
                      className={cn(
                        "flex h-9 items-center justify-center rounded-lg text-[13px] font-semibold duration-200",
                        selected
                          ? "bg-brand-blue text-soft-black shadow-sm"
                          : isToday
                            ? "border border-brand-blue-light bg-warm-white text-soft-black"
                            : "text-soft-black/70 hover:bg-warm-white",
                        disabled && "cursor-not-allowed text-soft-black/20 hover:bg-transparent",
                        focusRing
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3 rounded-2 border border-border-gray bg-warm-white p-4">
              <span className="inline-flex items-center gap-2 text-[14px] font-semibold">
                <Clock className="h-4 w-4 text-brand-blue" aria-hidden />
                Time
              </span>
              <input
                type="text"
                inputMode="numeric"
                value={selectedTime}
                onChange={(event) => {
                  setSelectedTime(event.target.value);
                  setTimeError("");
                }}
                maxLength={5}
                placeholder="09:00"
                aria-label="Scheduled time in 24-hour HH:MM format"
                aria-invalid={Boolean(timeError)}
                className={cn(
                  "w-full rounded-xl border border-border-gray bg-white px-4 py-3 text-[24px] font-bold tabular-nums text-soft-black",
                  "placeholder:text-soft-black/30 duration-200",
                  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
                  timeError && "border-red-300"
                )}
              />
              <p
                className={cn(
                  "text-[12px] font-normal text-soft-black/50",
                  timeError && "text-red-600"
                )}
              >
                {timeError || "24-hour format, HH:MM"}
              </p>
              <div className="mt-auto rounded-xl bg-white p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-soft-black/40">
                  Goes live
                </p>
                <p className="mt-1 text-[13px] font-semibold text-soft-black">
                  {TIME_PATTERN.test(selectedTime)
                    ? formatSchedule(scheduledDate)
                    : "Choose a valid time"}
                </p>
              </div>
            </section>
          </div>

          <div className="mt-6 flex flex-wrap justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex items-center justify-center rounded-2 border border-border-gray bg-white px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                  focusRing
                )}
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => void handleSchedule()}
              disabled={isSubmitting}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
                "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
                focusRing
              )}
            >
              <Send className="h-4 w-4" aria-hidden />
              {isSubmitting ? "Scheduling..." : "Schedule post"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
