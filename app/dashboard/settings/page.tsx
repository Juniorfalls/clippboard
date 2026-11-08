import { redirect } from "next/navigation";
import { BrandKitForm } from "@/components/BrandKitForm";
import { createClient } from "@/utils/supabase/server";

export default async function BrandKitSettingsPage() {
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
          Brand Kit
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Set the colors, type and logo Clippboard uses when it renders your
          clips.
        </p>
      </header>

      <BrandKitForm userId={user.id} />
    </div>
  );
}
