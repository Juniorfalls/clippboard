import { redirect } from "next/navigation";
import { TeamManagement } from "@/components/TeamManagement";
import { createClient } from "@/utils/supabase/server";

export default async function TeamPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
          Team
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Invite collaborators to this workspace and keep projects scoped to
          your team.
        </p>
      </header>

      <TeamManagement />
    </div>
  );
}
