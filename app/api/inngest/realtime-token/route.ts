import { NextResponse } from "next/server";
import { getClientSubscriptionToken } from "inngest/react";
import { inngest } from "@/lib/inngest/client";
import { videoProcessingChannel } from "@/lib/inngest/realtime";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let jobId: unknown;
  try {
    const body = (await request.json()) as { jobId?: unknown };
    jobId = body.jobId;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof jobId !== "string" || jobId.length === 0 || jobId.length > 120) {
    return NextResponse.json({ error: "Invalid job." }, { status: 400 });
  }

  const { data: job, error } = await supabase
    .from("video_jobs")
    .select("id")
    .eq("id", jobId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  try {
    const token = await getClientSubscriptionToken(inngest, {
      channel: videoProcessingChannel(jobId),
      topics: ["status"],
    });

    return NextResponse.json(token);
  } catch (error) {
    console.error("[inngest] Could not create realtime token", error);
    return NextResponse.json(
      { error: "Could not subscribe to processing updates." },
      { status: 503 }
    );
  }
}
