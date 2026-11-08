import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";
export const maxDuration = 60;

const VOICES = new Set([
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
]);
const MAX_SCRIPT_LENGTH = 1000;

type TTSBody = {
  voice?: unknown;
  script?: unknown;
};

export async function POST(request: Request) {
  let body: TTSBody;

  try {
    body = (await request.json()) as TTSBody;
  } catch {
    return NextResponse.json(
      { error: "Send a JSON voiceover request." },
      { status: 400 }
    );
  }

  const voice = typeof body.voice === "string" ? body.voice : "";
  const script = typeof body.script === "string" ? body.script.trim() : "";

  if (!VOICES.has(voice)) {
    return NextResponse.json({ error: "Choose a supported voice." }, { status: 400 });
  }

  if (script.length === 0) {
    return NextResponse.json(
      { error: "Add a voiceover script first." },
      { status: 400 }
    );
  }

  if (script.length > MAX_SCRIPT_LENGTH) {
    return NextResponse.json(
      { error: `Keep the script under ${MAX_SCRIPT_LENGTH} characters.` },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Voiceover generation is not configured yet." },
      { status: 500 }
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
  });

  try {
    const speech = await openai.audio.speech.create({
      model: process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts",
      voice,
      input: script,
      response_format: "mp3",
    });

    const buffer = Buffer.from(await speech.arrayBuffer());

    return NextResponse.json({
      audioUrl: `data:audio/mpeg;base64,${buffer.toString("base64")}`,
      voice,
      script,
    });
  } catch (error) {
    console.error("[tts] Voiceover generation failed", error);
    return NextResponse.json(
      { error: "The voiceover could not be generated. Please try again." },
      { status: 502 }
    );
  }
}
