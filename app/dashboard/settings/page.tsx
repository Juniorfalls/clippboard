import { redirect } from "next/navigation";
import { AccountSettingsForm } from "@/components/AccountSettingsForm";
import { BrandKitForm } from "@/components/BrandKitForm";
import { BrandTemplateManager } from "@/components/BrandTemplateManager";
import { createClient } from "@/utils/supabase/server";

export default async function SettingsPage() {
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
          Settings
        </h1>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Manage your account details and the brand Clippboard uses when it
          renders your clips.
        </p>
      </header>

      <AccountSettingsForm
        userId={user.id}
        initialName={
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : ""
        }
        initialEmail={user.email ?? ""}
      />

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-[24px] font-bold leading-[1.25]">Brand Kit</h2>
          <p className="mt-1 text-[14px] text-soft-black/60">
            Set the colors, type and logo Clippboard uses when it renders your
            clips.
          </p>
        </div>
        <BrandKitForm userId={user.id} />
      </section>
      <BrandTemplateManager userId={user.id} />
    </div>
  );
}
