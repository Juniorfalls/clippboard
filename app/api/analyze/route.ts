import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import type { Clip, TranscriptSegment } from "@/types/video";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 500;
const MAX_AUDIO_SIZE = 4 * 1024 * 1024;

const MomentSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    startTime: z.number().finite().min(0),
    endTime: z.number().finite().positive(),
    viralityScore: z.number().int().min(1).max(100),
  })
  .refine((moment) => moment.endTime > moment.startTime, {
    message: "endTime must be greater than startTime",
    path: ["endTime"],
  });

const AnalysisSchema = z.object({
  clips: z.array(MomentSchema).length(10),
});

type AnalysisResponse = z.infer<typeof AnalysisSchema>;

const OPENAI_RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    clips: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          startTime: { type: "number" },
          endTime: { type: "number" },
          viralityScore: { type: "integer", minimum: 1, maximum: 100 },
        },
        required: ["title", "startTime", "endTime", "viralityScore"],
      },
    },
  },
  required: ["clips"],
} as const;

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function buildTranscript(
  segments: Array<{ start: number; end: number; text: string }> | undefined,
  text: string
) {
  if (!segments?.length) {
    return text.trim();
  }

  return segments
    .map(
      (segment) =>
        `[${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s] ${segment.text.trim()}`
    )
    .join("\n");
}

function parseJsonContent(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  return JSON.parse(cleaned);
}

function roundToHundredths(value: number) {
  return Math.round(value * 100) / 100;
}

export async function POST(request: Request) {
  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return errorResponse("Send the audio file and prompt as form data.", 400);
  }

  const audioFile = form.get("audioFile");
  if (!(audioFile instanceof File) || audioFile.size === 0) {
    return errorResponse("Add an extracted audio file to analyze.", 400);
  }

  const hasAudioExtension = /\.(mp3|wav|m4a|webm|ogg|flac|mp4|mpeg|mpga)$/i.test(
    audioFile.name
  );

  if (!audioFile.type.startsWith("audio/") && !hasAudioExtension) {
    return errorResponse("That file is not a supported audio file.", 400);
  }

  if (audioFile.size > MAX_AUDIO_SIZE) {
    return errorResponse(
      "The extracted audio is too large for this deployment. Try a shorter video.",
      413
    );
  }

  const promptValue = form.get("prompt");
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return errorResponse(
      "AI analysis is not configured yet. Add OPENAI_API_KEY to the server environment.",
      500
    );
  }

  const openai = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
  });
  const transcriptionModel =
    process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";
  const analysisModel = process.env.OPENAI_MODEL ?? "gpt-4o";

  let transcript: string;
  let transcriptSegments: TranscriptSegment[] = [];

  try {
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: transcriptionModel,
      response_format: "verbose_json",
      timestamp_granularities: ["segment"],
    });

    transcriptSegments = (transcription.segments ?? [])
      .map((segment) => ({
        start: roundToHundredths(Math.max(0, segment.start)),
        end: roundToHundredths(Math.max(0, segment.end)),
        text: segment.text.trim(),
      }))
      .filter((segment) => segment.text.length > 0 && segment.end > segment.start);

    transcript = buildTranscript(transcription.segments, transcription.text);
  } catch (error) {
    console.error("[analyze] Whisper transcription failed", error);
    return errorResponse(
      "The audio could not be transcribed. Try a video with clear speech.",
      502
    );
  }

  if (!transcript) {
    return errorResponse(
      "No speech was detected in this video. Try a video with narration.",
      422
    );
  }

  try {
    const completion = await openai.chat.completions.create({
      model: analysisModel,
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "clip_analysis",
          strict: true,
          schema: OPENAI_RESPONSE_SCHEMA,
        },
      },
      messages: [
        {
          role: "system",
          content:
            "You are an expert short-form video editor. Analyze the transcript and select exactly 10 engaging, self-contained moments for TikTok, Reels, or Shorts. Each moment must start and end on a complete thought, include a strong hook, and be between 15 and 90 seconds long. For each clip, rate its virality from 1 to 100 based on hook strength, pacing, emotional payoff, and shareability. Use only timestamps present in the transcript. Return JSON only.",
        },
        {
          role: "user",
          content: `User request:\n${prompt}\n\nTranscript with timestamps in seconds:\n${transcript}\n\nReturn exactly 10 clips. Each clip must have a short title, startTime in seconds, endTime in seconds, and a viralityScore from 1 to 100.`,
        },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (typeof content !== "string" || content.trim().length === 0) {
      console.error("[analyze] OpenAI returned an empty response");
      return errorResponse(
        "The AI service returned no moments. Please try again.",
        502
      );
    }

    let parsed: unknown;
    try {
      parsed = parseJsonContent(content);
    } catch {
      console.error("[analyze] OpenAI returned invalid JSON");
      return errorResponse(
        "The AI returned an invalid response. Please try again.",
        502
      );
    }

    const validation = AnalysisSchema.safeParse(parsed);
    if (!validation.success) {
      console.error(
        "[analyze] OpenAI response failed validation",
        validation.error.flatten()
      );
      return errorResponse(
        "The AI returned an incomplete clip list. Please try again.",
        502
      );
    }

    const clips: Clip[] = (validation.data as AnalysisResponse).clips
      .map((moment) => {
        const startTime = roundToHundredths(Math.max(0, moment.startTime));
        const endTime = roundToHundredths(Math.max(startTime, moment.endTime));

        return {
          id: randomUUID(),
          title: moment.title.trim(),
          startTime,
          endTime,
          duration: roundToHundredths(endTime - startTime),
          viralityScore: moment.viralityScore,
          status: "pending" as const,
        };
      })
      .sort((a, b) => a.startTime - b.startTime);

    return NextResponse.json({ clips, transcript: transcriptSegments });
  } catch (error) {
    console.error("[analyze] Moment detection failed", error);
    return errorResponse(
      "The AI service could not analyze this transcript. Please try again.",
      502
    );
  }
}
