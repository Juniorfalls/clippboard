import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

type ScheduleBody = {
  connected_account_id?: unknown;
  video_url?: unknown;
  title?: unknown;
  scheduled_for?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as ScheduleBody | null;
  const connectedAccountId = body?.connected_account_id;
  const videoUrl = body?.video_url;
  const scheduledFor = body?.scheduled_for;
  const title =
    typeof body?.title === "string" && body.title.trim()
      ? body.title.trim().slice(0, 200)
      : "Untitled clip";

  if (typeof connectedAccountId !== "string" || !connectedAccountId) {
    return NextResponse.json(
      { error: "Choose a connected account." },
      { status: 400 }
    );
  }

  if (typeof videoUrl !== "string" || !/^https:\/\//i.test(videoUrl)) {
    return NextResponse.json(
      { error: "The clip is missing a public video URL." },
      { status: 400 }
    );
  }

  if (typeof scheduledFor !== "string") {
    return NextResponse.json(
      { error: "Choose a publish date and time." },
      { status: 400 }
    );
  }

  const scheduledDate = new Date(scheduledFor);
  if (
    Number.isNaN(scheduledDate.getTime()) ||
    scheduledDate.getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: "Choose a future publish time." },
      { status: 400 }
    );
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: account, error: accountError } = await supabase
    .from("connected_accounts")
    .select("id, platform")
    .eq("id", connectedAccountId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (accountError) {
    return NextResponse.json(
      { error: "Could not verify the connected account." },
      { status: 500 }
    );
  }

  if (!account) {
    return NextResponse.json(
      { error: "That connected account was not found." },
      { status: 404 }
    );
  }

  const { error } = await supabase.from("scheduled_posts").insert({
    user_id: user.id,
    connected_account_id: account.id,
    video_url: videoUrl,
    title,
    scheduled_for: scheduledDate.toISOString(),
    status: "pending",
  });

  if (error) {
    return NextResponse.json(
      { error: "Could not schedule this post." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
