import { redirect } from "next/navigation";
import { Activity, Film, ShieldCheck, Users } from "lucide-react";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type ProfileRow = {
  id: string;
  email: string | null;
  is_admin: boolean;
  created_at: string;
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

  const [{ data: metricsRows }, { data: recentProfiles }] = await Promise.all([
    supabase.rpc("admin_metrics"),
    supabase
      .from("profiles")
      .select("id, email, is_admin, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const stats = metricsRows?.[0] as
    | {
        total_users: number | string;
        total_clips: number | string;
        clips_this_week: number | string;
      }
    | undefined;

  const recentUsers = (recentProfiles ?? []) as ProfileRow[];

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
        aria-label="Recent users"
        className="overflow-hidden rounded-3 border border-gray-200 bg-white"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-5 py-4">
          <div>
            <h2 className="text-[24px] font-bold leading-[1.25]">Recent users</h2>
            <p className="mt-1 text-[14px] text-soft-black/60">
              The 10 most recent accounts.
            </p>
          </div>
          <span className="rounded-full bg-warm-white px-3 py-1.5 text-[12px] font-semibold text-soft-black/60">
            {recentUsers.length} shown
          </span>
        </div>

        {recentUsers.length === 0 ? (
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
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map((person) => (
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
                          person.is_admin
                            ? "inline-flex rounded-full border border-brand-blue-light bg-brand-blue-light/60 px-3 py-1 text-[12px] font-semibold text-soft-black"
                            : "inline-flex rounded-full border border-gray-200 bg-warm-white px-3 py-1 text-[12px] font-semibold text-soft-black/60"
                        }
                      >
                        {person.is_admin ? "Admin" : "Member"}
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
