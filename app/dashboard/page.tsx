import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WorkspaceDashboard } from "@/components/WorkspaceDashboard";

export default async function WorkspacePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <WorkspaceDashboard userId={user.id} />;
}
