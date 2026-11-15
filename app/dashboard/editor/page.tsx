import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { VideoEditor } from "@/components/editor/VideoEditor";

export const metadata: Metadata = {
  title: "Video Editor",
  description:
    "Stitch clips, add text and logos, and export a finished video in the Clippboard standalone editor.",
  robots: { index: false, follow: false },
};

export default async function EditorPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return <VideoEditor userId={user.id} />;
}
