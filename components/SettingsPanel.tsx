"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Check,
  CreditCard,
  Instagram,
  Link2,
  Loader2,
  Music2,
  Save,
  SlidersHorizontal,
  UserRound,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import type { Plan } from "@/lib/plans";
import {
  SOCIAL_PLATFORMS,
  loadConnectedAccounts,
  saveConnectedAccounts,
  type SocialPlatformId,
} from "@/lib/social-accounts";

type Tab = "profile" | "billing" | "integrations" | "preferences";

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "profile", label: "Profile", icon: UserRound },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Link2 },
  { id: "preferences", label: "Preferences", icon: SlidersHorizontal },
];

const PLATFORM_ICONS: Record<SocialPlatformId, LucideIcon> = {
  tiktok: Music2,
  youtube: Youtube,
  instagram: Instagram,
};

const PLAN_LABELS: Record<Plan, string> = {
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";
const inputClass = cn(
  "block w-full rounded-2 border border-border-gray bg-white px-4 py-3 text-[16px] text-soft-black placeholder:text-soft-black/40 duration-200",
  focusRing
);

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-6 rounded-2 border border-border-gray bg-white px-4 py-4">
      <div>
        <p className="text-[16px] font-semibold text-soft-black">{label}</p>
        <p className="mt-1 text-[13px] text-soft-black/55">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full duration-200",
          checked ? "bg-brand-blue" : "bg-border-gray",
          focusRing
        )}
      >
        <span
          className={cn(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm duration-200",
            checked ? "left-6" : "left-1"
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}

export function SettingsPanel({
  userId,
  initialEmail,
  initialFullName,
  initialCompanyName,
  plan,
}: {
  userId: string;
  initialEmail: string;
  initialFullName: string;
  initialCompanyName: string;
  plan: Plan;
}) {
  const [tab, setTab] = useState<Tab>("profile");
  const [fullName, setFullName] = useState(initialFullName);
  const [companyName, setCompanyName] = useState(initialCompanyName);
  const [isSaving, setIsSaving] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [autoDownload, setAutoDownload] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<SocialPlatformId[]>(
    []
  );

  useEffect(() => {
    setConnectedAccounts(loadConnectedAccounts(userId));

    try {
      const raw = window.localStorage.getItem(
        `clippboard:preferences:${userId}`
      );
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        emailNotifications?: unknown;
        autoDownload?: unknown;
      };
      if (typeof saved.emailNotifications === "boolean") {
        setEmailNotifications(saved.emailNotifications);
      }
      if (typeof saved.autoDownload === "boolean") {
        setAutoDownload(saved.autoDownload);
      }
    } catch {
      // Invalid local preferences fall back to defaults.
    }
  }, [userId]);

  async function handleProfileSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim() || null,
          company_name: companyName.trim() || null,
        })
        .eq("id", userId);

      if (error) throw error;
      toast.success("Profile updated");
    } catch (error) {
      toast.error("Could not update profile", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  }

  function toggleIntegration(id: SocialPlatformId, label: string) {
    const isConnected = connectedAccounts.includes(id);
    const next = isConnected
      ? connectedAccounts.filter((account) => account !== id)
      : [...connectedAccounts, id];

    try {
      saveConnectedAccounts(userId, next);
      setConnectedAccounts(next);
      toast.success(
        isConnected ? `${label} disconnected` : `${label} connected`
      );
    } catch {
      toast.error("Could not update connected accounts", {
        description: "Check your browser storage settings and try again.",
      });
    }
  }

  function savePreferences() {
    try {
      window.localStorage.setItem(
        `clippboard:preferences:${userId}`,
        JSON.stringify({ emailNotifications, autoDownload })
      );
      toast.success("Preferences saved");
    } catch {
      toast.error("Could not save preferences", {
        description: "Check your browser storage settings and try again.",
      });
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
      <nav
        aria-label="Settings sections"
        className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col"
      >
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-[14px] font-semibold duration-200 hover:bg-warm-white lg:text-[16px]",
                active
                  ? "bg-brand-blue-light/70 text-soft-black"
                  : "text-soft-black/60 hover:text-soft-black",
                focusRing
              )}
            >
              <Icon className="h-5 w-5" aria-hidden />
              {label}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        {tab === "profile" && (
          <form
            onSubmit={handleProfileSave}
            noValidate
            className="flex flex-col gap-5 rounded-3 border border-border-gray bg-white p-6 sm:p-8"
          >
            <div>
              <h2 className="text-[24px] font-bold leading-[1.25]">Profile</h2>
              <p className="mt-1 text-[14px] text-soft-black/60">
                Update the details associated with your workspace account.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-email" className="text-[14px] font-semibold text-soft-black">
                Email
              </label>
              <input
                id="profile-email"
                value={initialEmail}
                readOnly
                aria-readonly="true"
                className={cn(
                  inputClass,
                  "cursor-not-allowed border-transparent bg-warm-white text-soft-black/50"
                )}
              />
              <p className="text-[12px] text-soft-black/50">
                Contact support to change the email used for sign-in.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-name" className="text-[14px] font-semibold text-soft-black">
                  Full Name
                </label>
                <input
                  id="profile-name"
                  name="fullName"
                  autoComplete="name"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Your full name"
                  className={inputClass}
                  maxLength={100}
                  disabled={isSaving}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="profile-company" className="text-[14px] font-semibold text-soft-black">
                  Company Name
                </label>
                <input
                  id="profile-company"
                  name="companyName"
                  autoComplete="organization"
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  placeholder="Your company"
                  className={inputClass}
                  maxLength={100}
                  disabled={isSaving}
                />
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
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {isSaving ? "Saving changes..." : "Save Changes"}
            </button>
          </form>
        )}

        {tab === "billing" && (
          <section className="flex flex-col gap-5 rounded-3 border border-border-gray bg-white p-6 sm:p-8">
            <div>
              <h2 className="text-[24px] font-bold leading-[1.25]">Billing</h2>
              <p className="mt-1 text-[14px] text-soft-black/60">
                Manage your subscription and plan limits.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2 border border-brand-blue-light bg-brand-blue-light/40 p-5">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-soft-black/50">
                  Current plan
                </p>
                <p className="mt-1 text-[24px] font-bold">{PLAN_LABELS[plan]}</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue-light bg-white px-3 py-1.5 text-[12px] font-semibold text-soft-black/70">
                <Check className="h-4 w-4 text-brand-blue" aria-hidden />
                Active
              </span>
            </div>

            <p className="text-[14px] leading-relaxed text-soft-black/60">
              {plan === "starter"
                ? "Starter includes up to 3 generated clips per month and 1080p exports."
                : plan === "pro"
                  ? "Pro includes unlimited clips, 4K exports, and watermark-free downloads."
                  : "Agency includes everything in Pro plus Final Cut Pro XML export and MCP access."}
            </p>

            <a
              href="/api/billing-portal"
              className={cn(
                "inline-flex w-fit items-center justify-center rounded-2 border border-border-gray bg-white px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                focusRing
              )}
            >
              Manage Subscription
            </a>
          </section>
        )}

        {tab === "integrations" && (
          <section className="flex flex-col gap-5 rounded-3 border border-border-gray bg-white p-6 sm:p-8">
            <div>
              <h2 className="text-[24px] font-bold leading-[1.25]">
                Connected Accounts
              </h2>
              <p className="mt-1 text-[14px] text-soft-black/60">
                Connect the social platforms you publish clips to.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {SOCIAL_PLATFORMS.map((platform) => {
                const Icon = PLATFORM_ICONS[platform.id];
                const connected = connectedAccounts.includes(platform.id);

                return (
                  <div
                    key={platform.id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2 border border-gray-200 bg-white p-6"
                  >
                    <div className="flex min-w-0 items-center gap-4">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-warm-white text-soft-black">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[16px] font-semibold text-soft-black">
                          {platform.label}
                        </p>
                        <p className="mt-1 text-[13px] text-soft-black/55">
                          {platform.description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {connected && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
                          Connected
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => toggleIntegration(platform.id, platform.label)}
                        className={cn(
                          "inline-flex items-center justify-center rounded-2 border border-border-gray bg-white px-4 py-2.5 text-[14px] font-semibold text-soft-black duration-200 hover:bg-warm-white",
                          focusRing
                        )}
                      >
                        {connected ? "Disconnect" : "Connect"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {tab === "preferences" && (
          <section className="flex flex-col gap-5 rounded-3 border border-border-gray bg-white p-6 sm:p-8">
            <div>
              <h2 className="text-[24px] font-bold leading-[1.25]">
                Preferences
              </h2>
              <p className="mt-1 text-[14px] text-soft-black/60">
                Choose how Clippboard works with your workflow.
              </p>
            </div>

            <Toggle
              label="Email notifications"
              description="Receive account updates and export reminders."
              checked={emailNotifications}
              onChange={setEmailNotifications}
            />
            <Toggle
              label="Auto-download clips"
              description="Start downloads automatically when a rendering finishes."
              checked={autoDownload}
              onChange={setAutoDownload}
            />

            <button
              type="button"
              onClick={savePreferences}
              className={cn(
                "inline-flex w-fit items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3 text-[14px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
                focusRing
              )}
            >
              <Save className="h-4 w-4" aria-hidden />
              Save Preferences
            </button>
          </section>
        )}
      </div>
    </div>
  );
}
