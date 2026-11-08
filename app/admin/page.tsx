import { redirect } from "next/navigation";
import { Activity, Film, ShieldCheck, Users } from "lucide-react";
import { AdminErrorToast } from "@/components/AdminErrorToast";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  email: string | null;
  is_admin: boolean;
  plan: "starter" | "pro" | "agency";
  created_at: string;
};

const PLAN_LABELS: Record<ProfileRow["plan"], string> = {
  starter: "Starter",
  pro: "Pro",
  agency: "Agency",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export default async function AdminPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/dashboard?error=unauthorized");
  }

  let metricsRows: unknown = null;
  let allUsers: ProfileRow[] = [];
  let dataError: string | null = null;

  try {
    const [metricsResult, usersResult] = await Promise.all([
      supabase.rpc("admin_metrics"),
      supabase
        .from("profiles")
        .select("id, email, is_admin, plan, created_at")
        .order("created_at", { ascending: false }),
    ]);

    if (metricsResult.error) throw metricsResult.error;
    if (usersResult.error) throw usersResult.error;

    metricsRows = metricsResult.data;
    allUsers = (usersResult.data ?? []) as ProfileRow[];
  } catch (error) {
    dataError =
      error instanceof Error ? error.message : "Unexpected Supabase error.";
  }

  const stats = (metricsRows as
    | {
        total_users: number | string;
        total_clips: number | string;
        clips_this_week: number | string;
      }[]
    | null)?.[0];

  const metrics = [
    {
      label: "Total Users",
      value: Number(stats?.total_users ?? 0).toLocaleString(),
      detail: "Accounts in auth.users",
      icon: Users,
    },
    {
      label: "Total Clips Generated",
      value: Number(stats?.total_clips ?? 0).toLocaleString(),
      detail: "Persisted clip records",
      icon: Film,
    },
    {
      label: "Clips This Week",
      value: Number(stats?.clips_this_week ?? 0).toLocaleString(),
      detail: "Generated in the last 7 days",
      icon: Activity,
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      <AdminErrorToast message={dataError} />
      <header className="flex flex-col gap-3">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-blue-light bg-brand-blue-light/50 px-3 py-1.5 text-[12px] font-semibold text-soft-black/70">
          <ShieldCheck className="h-4 w-4 text-brand-blue" aria-hidden />
          Restricted access
        </span>
        <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
          Admin
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Monitor account growth and platform activity across Clippboard.
        </p>
      </header>

      <section aria-label="Platform metrics" className="grid gap-4 md:grid-cols-3">
        {metrics.map(({ label, value, detail, icon: Icon }) => (
          <article
            key={label}
            className="rounded-3 border border-gray-200 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-semibold uppercase tracking-wide text-soft-black/50">
                  {label}
                </p>
                <p className="mt-2 text-[32px] font-bold leading-[1.1] -tracking-1">
                  {value}
                </p>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
                <Icon className="h-5 w-5" aria-hidden />
              </span>
            </div>
            <p className="mt-4 text-[12px] text-soft-black/50">{detail}</p>
          </article>
        ))}
      </section>

      <section
        aria-label="All users"
        className="overflow-hidden rounded-3 border border-gray-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-[24px] font-bold leading-[1.25]">All users</h2>
            <p className="mt-1 text-[14px] text-soft-black/60">
              Every account, signup date and current plan.
            </p>
          </div>
          <span className="rounded-full bg-warm-white px-3 py-1.5 text-[12px] font-semibold text-soft-black/60">
            {allUsers.length} total
          </span>
        </div>

        {allUsers.length === 0 ? (
          <div className="px-5 py-12 text-center text-[14px] text-soft-black/60">
            No user profiles have been created yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-warm-white/70">
                  <th scope="col" className="px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-soft-black/50">
                    Email
                  </th>
                  <th scope="col" className="px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-soft-black/50">
                    Signup Date
                  </th>
                  <th scope="col" className="px-5 py-3 text-[12px] font-semibold uppercase tracking-wide text-soft-black/50">
                    Plan
                  </th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((person) => (
                  <tr key={person.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="px-5 py-4 text-[14px] font-semibold text-soft-black">
                      {person.email ?? "No email"}
                    </td>
                    <td className="px-5 py-4 text-[14px] text-soft-black/60">
                      {formatDate(person.created_at)}
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={
                          person.plan === "agency"
                            ? "inline-flex rounded-full border border-brand-blue bg-brand-blue-light/70 px-3 py-1 text-[12px] font-semibold text-soft-black"
                            : person.plan === "pro"
                              ? "inline-flex rounded-full border border-brand-blue-light bg-brand-blue-light/50 px-3 py-1 text-[12px] font-semibold text-soft-black"
                              : "inline-flex rounded-full border border-gray-200 bg-warm-white px-3 py-1 text-[12px] font-semibold text-soft-black/60"
                        }
                      >
                        {PLAN_LABELS[person.plan] ?? "Starter"}
                        {person.is_admin ? " · Admin" : ""}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
