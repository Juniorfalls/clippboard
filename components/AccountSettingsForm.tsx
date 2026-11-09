"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Mail, Save, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const inputClass = cn(
  "block w-full rounded-2xl border border-border-gray bg-white px-4 py-3 text-[16px] text-soft-black placeholder:text-soft-black/40 duration-200",
  focusRing
);

export function AccountSettingsForm({
  userId,
  initialName,
  initialEmail,
}: {
  userId: string;
  initialName: string;
  initialEmail: string;
}) {
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(`clippboard:account:${userId}`);
      if (!raw) return;
      const saved = JSON.parse(raw) as { name?: unknown; email?: unknown };
      if (typeof saved.name === "string") setName(saved.name);
      if (typeof saved.email === "string") setEmail(saved.email);
    } catch {
      // Ignore invalid local preferences and keep the account defaults.
    }
  }, [userId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      toast.error("Add your name");
      return;
    }

    if (!EMAIL_PATTERN.test(email.trim())) {
      toast.error("Enter a valid email address");
      return;
    }

    setIsSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 350));

    try {
      window.localStorage.setItem(
        `clippboard:account:${userId}`,
        JSON.stringify({ name: name.trim(), email: email.trim() })
      );
      toast.success("Account details saved");
    } catch {
      toast.error("Could not save account details", {
        description: "Check your browser storage settings and try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex flex-col gap-5 rounded-3 border border-border-gray bg-white p-6 sm:p-8"
    >
      <div>
        <h2 className="text-[24px] font-bold leading-[1.25]">Account Details</h2>
        <p className="mt-1 text-[14px] text-soft-black/60">
          Update how your account appears across the workspace.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="account-name" className="text-[14px] font-semibold text-soft-black">
            Name
          </label>
          <div className="relative">
            <UserRound
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-soft-black/35"
              aria-hidden
            />
            <input
              id="account-name"
              name="name"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              className={cn(inputClass, "pl-11")}
              maxLength={100}
              disabled={isSaving}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="account-email" className="text-[14px] font-semibold text-soft-black">
            Email
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-soft-black/35"
              aria-hidden
            />
            <input
              id="account-email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className={cn(inputClass, "pl-11")}
              maxLength={254}
              disabled={isSaving}
            />
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={isSaving}
        aria-busy={isSaving}
        className={cn(
          "inline-flex w-fit items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
          focusRing
        )}
      >
        <Save className="h-4 w-4" aria-hidden />
        {isSaving ? "Saving changes..." : "Save Changes"}
      </button>
    </form>
  );
}
