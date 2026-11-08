import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { WorkspaceDashboard } from "@/components/WorkspaceDashboard";
import { normalizePlan } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Workspace",
  description:
    "Generate, edit, caption, and export engaging short-form clips from your long-form videos.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Workspace | Clippboard",
    description:
      "Generate, edit, caption, and export engaging short-form clips from your long-form videos.",
    images: [
      {
        // Replace /public/og-image.png with the final social preview image.
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Clippboard workspace",
      },
    ],
  },
};

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
