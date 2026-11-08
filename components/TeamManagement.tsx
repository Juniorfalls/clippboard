"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Mail, Plus, ShieldCheck, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { useTeam } from "@/components/TeamProvider";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  status: "active" | "invited";
  user_id: string | null;
  created_at: string;
};

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function memberInitial(email: string) {
  return email.trim().charAt(0).toUpperCase() || "?";
}

export function TeamManagement() {
  const { activeTeam, activeTeamId, loading: teamsLoading, refreshTeams } = useTeam();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [email, setEmail] = useState("");
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!activeTeamId) {
      setMembers([]);
      return;
    }

    setLoadingMembers(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("team_members")
        .select("id, email, role, status, user_id, created_at")
        .eq("team_id", activeTeamId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMembers((data ?? []) as TeamMember[]);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "Could not load team members."
      );
    } finally {
      setLoadingMembers(false);
    }
  }, [activeTeamId]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function handleInvite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const invitedEmail = email.trim().toLowerCase();
    if (!activeTeamId) {
      toast.error("No workspace selected", {
        description: "Choose or create a team workspace first.",
      });
      return;
    }
    if (!EMAIL_PATTERN.test(invitedEmail)) {
      toast.error("Enter a valid email address");
      return;
    }

    setInviting(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Your session expired. Please sign in again.");

      const { error } = await supabase.from("team_members").insert({
        team_id: activeTeamId,
        email: invitedEmail,
        role: "member",
        status: "invited",
        invited_by: user.id,
      });

      if (error) {
        if (error.code === "23505") {
          throw new Error("That email is already part of this workspace.");
        }
        throw error;
      }

      setEmail("");
      await loadMembers();
      await refreshTeams();
      toast.success("Invite created", {
        description: `${invitedEmail} will join when they sign in with that email.`,
      });
    } catch (error) {
      toast.error("Could not invite teammate", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setInviting(false);
    }
  }

  if (teamsLoading) {
    return (
      <div className="rounded-3 border border-border-gray bg-white p-6">
        <div className="h-5 w-44 animate-pulse rounded-full bg-border-gray" />
        <div className="mt-4 h-3 w-64 animate-pulse rounded-full bg-border-gray" />
      </div>
    );
  }

  if (!activeTeam) {
    return (
      <div className="rounded-3 border border-dashed border-border-gray bg-white px-6 py-14 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue-light text-brand-blue">
          <UsersRound className="h-7 w-7" aria-hidden />
        </span>
        <h2 className="text-[20px] font-bold">No team workspace yet</h2>
        <p className="mx-auto mt-2 max-w-sm text-[16px] text-soft-black/60">
          Reload the workspace to create your personal team.
        </p>
      </div>
    );
  }

  const activeCount = members.filter((member) => member.status === "active").length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3 border border-border-gray bg-white p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-wide text-soft-black/50">
              Current workspace
            </p>
            <h2 className="mt-1 text-[24px] font-bold leading-[1.25]">
              {activeTeam.name}
            </h2>
            <p className="mt-1 text-[14px] text-soft-black/60">
              {activeCount} active member{activeCount === 1 ? "" : "s"} ·{" "}
              {members.length} total
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue-light bg-brand-blue-light/40 px-3 py-1.5 text-[12px] font-semibold capitalize text-soft-black/70">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            {activeTeam.role}
          </span>
        </div>
      </section>

      <section className="rounded-3 border border-border-gray bg-white p-5 md:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
            <Mail className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-[20px] font-bold leading-[1.25]">
              Invite a teammate
            </h2>
            <p className="mt-1 text-[14px] text-soft-black/60">
              Add their email. They will join this workspace the next time they
              sign in.
            </p>
          </div>
        </div>

        <form onSubmit={handleInvite} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-soft-black">
              Email address
            </span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="teammate@company.com"
              autoComplete="off"
              disabled={inviting}
              className={cn(
                "w-full rounded-lg border border-border-gray bg-white px-4 py-3 text-[16px] text-soft-black placeholder:text-soft-black/40",
                "duration-200 focus:border-brand-blue disabled:cursor-not-allowed disabled:opacity-60",
                focusRing
              )}
            />
          </label>
          <button
            type="submit"
            disabled={inviting || !email.trim()}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-2 bg-brand-blue px-5 py-3 text-[16px] font-semibold text-soft-black duration-200 hover:bg-brand-blue-hover",
              "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60",
              focusRing
            )}
          >
            <Plus className="h-4 w-4" aria-hidden />
            {inviting ? "Inviting..." : "Send invite"}
          </button>
        </form>
      </section>

      <section className="rounded-3 border border-border-gray bg-white p-5 md:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[20px] font-bold leading-[1.25]">Members</h2>
          {loadingMembers && (
            <span className="text-[12px] font-semibold text-soft-black/50">
              Loading...
            </span>
          )}
        </div>

        {loadError ? (
          <p className="mt-4 rounded-2 border border-red-200 bg-red-50 px-4 py-3 text-[14px] text-soft-black/70">
            {loadError}
          </p>
        ) : members.length === 0 ? (
          <p className="mt-4 text-[14px] text-soft-black/60">
            No members in this workspace yet.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border-gray">
            {members.map((member) => (
              <li
                key={member.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-warm-white text-[14px] font-bold text-soft-black/70">
                    {memberInitial(member.email)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[16px] font-semibold text-soft-black">
                      {member.email}
                    </p>
                    <p className="text-[12px] font-semibold capitalize text-soft-black/50">
                      {member.role}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold capitalize",
                    member.status === "active"
                      ? "border-brand-blue-light bg-brand-blue-light/40 text-soft-black/70"
                      : "border-border-gray bg-warm-white text-soft-black/60"
                  )}
                >
                  {member.status === "active" ? (
                    <UsersRound className="h-3.5 w-3.5" aria-hidden />
                  ) : (
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                  )}
                  {member.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
