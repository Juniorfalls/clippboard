import { NextResponse } from "next/server";

const ALLOWED_PLATFORMS = new Set(["tiktok", "youtube"]);

type PublishBody = {
  clipId?: unknown;
  title?: unknown;
  scheduledFor?: unknown;
  platforms?: unknown;
};

export async function POST(request: Request) {
  let body: PublishBody;

  try {
    body = (await request.json()) as PublishBody;
  } catch {
    return NextResponse.json({ error: "Send a JSON publishing request." }, { status: 400 });
  }

  if (typeof body.clipId !== "string" || body.clipId.trim().length === 0) {
    return NextResponse.json({ error: "A clip ID is required." }, { status: 400 });
  }

  if (typeof body.scheduledFor !== "string") {
    return NextResponse.json(
      { error: "A scheduled publish time is required." },
      { status: 400 }
    );
  }

  const scheduledFor = new Date(body.scheduledFor);
  if (Number.isNaN(scheduledFor.getTime())) {
    return NextResponse.json({ error: "That publish time is not valid." }, { status: 400 });
  }

  if (scheduledFor.getTime() <= Date.now()) {
    return NextResponse.json(
      { error: "Choose a publish time in the future." },
      { status: 400 }
    );
  }

  const platforms = Array.isArray(body.platforms)
    ? body.platforms.filter(
        (platform): platform is string =>
          typeof platform === "string" && ALLOWED_PLATFORMS.has(platform)
      )
    : [];

  if (platforms.length === 0) {
    return NextResponse.json(
      { error: "Select at least one publishing destination." },
      { status: 400 }
    );
  }

  // OAuth connection and upload workers will be wired in here later.
  return NextResponse.json({
    scheduled: true,
    clipId: body.clipId,
    title: typeof body.title === "string" ? body.title : "Untitled clip",
    scheduledFor: scheduledFor.toISOString(),
    platforms,
  });
}
