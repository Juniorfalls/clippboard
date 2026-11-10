import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { inngest } from "@/lib/inngest/client";
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
    blobUrl,
    prompt: promptValue,
    options: optionsValue,
    userId: requestedUserId,
    sourceName: sourceNameValue,
  } = payload as {
    blobUrl?: unknown;
    prompt?: unknown;
    options?: unknown;
    userId?: unknown;
    sourceName?: unknown;
  };

  if (requestedUserId && requestedUserId !== user.id) {
    return errorResponse("This upload does not belong to your account.", 403);
  }

  if (
    typeof blobUrl !== "string" ||
    blobUrl.length === 0 ||
    blobUrl.length > MAX_BLOB_URL_LENGTH
  ) {
    return errorResponse("Add the uploaded file URL to analyze.", 400);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(blobUrl);
  } catch {
    return errorResponse("That uploaded file URL is not valid.", 400);
  }

  if (parsedUrl.protocol !== "https:") {
    return errorResponse("The uploaded file URL must use HTTPS.", 400);
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

  const options =
    typeof optionsValue === "object" &&
    optionsValue !== null &&
    !Array.isArray(optionsValue)
      ? (optionsValue as Record<string, unknown>)
      : {};

  const jobId = randomUUID();

  try {
    const result = await inngest.send({
      id: jobId,
      name: "video/process.requested",
      data: {
        jobId,
        blobUrl: parsedUrl.toString(),
        prompt,
        userId: user.id,
        sourceName:
          typeof sourceNameValue === "string"
            ? sourceNameValue.slice(0, 240)
            : undefined,
        options,
      },
    });

    return NextResponse.json(
      { jobId, eventId: result.ids[0] ?? null },
      { status: 202 }
    );
  } catch (error) {
    console.error("[analyze] Could not queue video processing", error);
    return errorResponse(
      "Could not queue video processing. Check that Inngest is configured.",
      503
    );
  }
}
