import { NextResponse } from "next/server";
import { generateMockClips } from "@/lib/mock-clips";
import type { ApiError, GenerateClipsResponse } from "@/lib/types";

export const runtime = "nodejs";

const MAX_TEXT = 80;
const FORMATS = ["tiktok-9-16", "landscape-16-9"];
const RESOLUTIONS = ["1080p", "4k"];

function fail(message: string, status = 400) {
  return NextResponse.json<ApiError>({ error: message }, { status });
}

export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Send the video and settings as form data.");
  }

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return fail("Add a video file to generate clips.");
  }
  if (!file.type.startsWith("video/")) {
    return fail("That file is not a video.");
  }

  const overlayText = String(form.get("overlayText") ?? "").trim();
  if (overlayText.length > MAX_TEXT) {
    return fail(`On-screen text can be up to ${MAX_TEXT} characters.`);
  }

  const format = String(form.get("format") ?? "tiktok-9-16");
  const resolution = String(form.get("resolution") ?? "4k");
  if (!FORMATS.includes(format) || !RESOLUTIONS.includes(resolution)) {
    return fail("Unknown format or resolution.");
  }

  // The file is received but not stored or read: this step is mocked.
  const clips = await generateMockClips({
    fileName: file.name,
    overlayText,
    format,
    resolution,
  });

  return NextResponse.json<GenerateClipsResponse>({ clips });
}
