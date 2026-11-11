import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
import { normalizePlan, STARTER_CLIP_LIMIT } from "@/lib/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const MAX_PROMPT_LENGTH = 500;
const MAX_BLOB_URL_LENGTH = 2048;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return errorResponse("Sign in to analyze a video.", 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return errorResponse("Send the uploaded file URL and prompt as JSON.", 400);
  }

  if (typeof payload !== "object" || payload === null) {
    return errorResponse("Send the uploaded file URL and prompt as JSON.", 400);
  }

  const {
    audioBlobUrl,
    blobUrl,
    prompt: promptValue,
    options: optionsValue,
    userId: requestedUserId,
    sourceName: sourceNameValue,
  } = payload as {
    audioBlobUrl?: unknown;
    blobUrl?: unknown;
    prompt?: unknown;
    options?: unknown;
    userId?: unknown;
    sourceName?: unknown;
  };

  const uploadedFileUrl = audioBlobUrl ?? blobUrl;

  if (requestedUserId && requestedUserId !== user.id) {
    return errorResponse("This upload does not belong to your account.", 403);
  }

  if (
    typeof uploadedFileUrl !== "string" ||
    uploadedFileUrl.length === 0 ||
    uploadedFileUrl.length > MAX_BLOB_URL_LENGTH
  ) {
    return errorResponse("Add the uploaded audio URL to analyze.", 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(uploadedFileUrl);
  } catch {
    return errorResponse("That uploaded audio URL is not valid.", 400);
  }

  if (parsedUrl.protocol !== "https:") {
    return errorResponse("The uploaded audio URL must use HTTPS.", 400);
  }

  const prompt =
    typeof promptValue === "string" && promptValue.trim().length > 0
      ? promptValue.trim()
      : "Find the 10 most engaging moments for TikTok.";

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return errorResponse(
      `The prompt can be up to ${MAX_PROMPT_LENGTH} characters.`,
      400
    );
  }

  const now = new Date();
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
  ).toISOString();

  let plan = normalizePlan(undefined);
  let clipsUsed = 0;

  try {
    const admin = createAdminClient();
    const [
      { data: profile, error: profileError },
      { count, error: countError },
    ] = await Promise.all([
      admin
        .from("profiles")
        .select("plan")
        .eq("id", user.id)
        .maybeSingle(),
      admin
        .from("clips")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", monthStart),
    ]);

    if (profileError) throw profileError;
    if (countError) throw countError;

    plan = normalizePlan(profile?.plan);
    clipsUsed = count ?? 0;
  } catch (error) {
    console.error("[analyze] Could not verify plan usage", error);
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    return errorResponse(`Error verifying plan usage: ${message}`, 500);
  }

  const starterRemaining = Math.max(0, STARTER_CLIP_LIMIT - clipsUsed);

  if (plan === "starter" && starterRemaining === 0) {
    return errorResponse(
      "You have reached your Starter plan limit. Please upgrade to Pro.",
      403
    );
  }

  const maxClips =
    plan === "starter" ? Math.min(10, starterRemaining) : 10;

  const options =
    typeof optionsValue === "object" &&
    optionsValue !== null &&
    !Array.isArray(optionsValue)
      ? (optionsValue as Record<string, unknown>)
      : {};

  const jobId = randomUUID();
  const sourceName =
    typeof sourceNameValue === "string"
      ? sourceNameValue.slice(0, 240)
      : null;
  const eventKey = process.env.INNGEST_EVENT_KEY?.trim();

  if (!eventKey && process.env.INNGEST_DEV !== "1") {
    console.error("[analyze] INNGEST_EVENT_KEY is missing");
    return errorResponse(
      "Inngest is not configured. Add INNGEST_EVENT_KEY to the server environment.",
      503
    );
  }

  try {
    const admin = createAdminClient();
    const { error: jobError } = await admin.from("video_jobs").upsert(
      {
        id: jobId,
        user_id: user.id,
        status: "queued",
        prompt,
        source_name: sourceName,
        options,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

    if (jobError) throw jobError;
  } catch (error) {
    console.error("[analyze] Could not create video job", error);
    const message =
      error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : String(error);
    return errorResponse(`Could not create video job: ${message}`, 500);
  }

  try {
    const result = await inngest.send({
      id: jobId,
      name: "video/process.requested",
      data: {
        jobId,
        audioBlobUrl: parsedUrl.toString(),
        prompt,
        userId: user.id,
        maxClips,
        sourceName: sourceName ?? undefined,
        options,
      },
    });

    return NextResponse.json(
      { jobId, eventId: result.ids[0] ?? null },
      { status: 202 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[analyze] Could not queue video processing", message);

    try {
      const admin = createAdminClient();
      await admin
        .from("video_jobs")
        .update({
          status: "failed",
          error: message,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);
    } catch (updateError) {
      console.error("[analyze] Could not mark video job as failed", updateError);
    }

    if (message.toLowerCase().includes("unauthorized")) {
      return errorResponse(
        "Inngest rejected the event key. Confirm INNGEST_EVENT_KEY belongs to this Inngest environment.",
        503
      );
    }

    return errorResponse(
      "Could not queue video processing. Check that Inngest is configured.",
      503
    );
  }
}
