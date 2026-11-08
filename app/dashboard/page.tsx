import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WorkspaceDashboard } from "@/components/WorkspaceDashboard";
import { normalizePlan } from "@/lib/plans";

export default async function WorkspacePage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { count: clipsThisMonth }] = await Promise.all([
    supabase
      .from("profiles")
      .select("plan")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("clips")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
      ).toISOString()),
  ]);

  return (
    <WorkspaceDashboard
      userId={user.id}
      plan={normalizePlan(profile?.plan)}
      initialClipsThisMonth={clipsThisMonth ?? 0}
      unauthorized={searchParams.error === "unauthorized"}
    />
  );
}
