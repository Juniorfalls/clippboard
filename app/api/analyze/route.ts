import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import OpenAI from "openai";
import { z } from "zod";
import { findPexelsBroll } from "@/lib/pexels";
import { findSilenceCuts } from "@/lib/silence";
import type { Clip, TranscriptSegment } from "@/types/video";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_PROMPT_LENGTH = 500;
const MAX_AUDIO_SIZE = 24 * 1024 * 1024;
const MAX_BLOB_URL_LENGTH = 2048;

const BRollSchema = z.object({
  query: z.string().trim().min(1).max(120),
  startTime: z.number().finite().min(0),
  duration: z.number().finite().min(1).max(3),
});

const FillerCutSchema = z
  .object({
    start: z.number().finite().min(0),
    end: z.number().finite().positive(),
  })
  .refine((range) => range.end > range.start, {
    message: "Filler cut end must be greater than start",
    path: ["end"],
  });

const MomentSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    hookText: z.string().trim().min(1).max(80),
    startTime: z.number().finite().min(0),
    endTime: z.number().finite().positive(),
    engagementScore: z.number().int().min(1).max(100),
    viralityReason: z.string().trim().min(1).max(240),
    fillerCuts: z.array(FillerCutSchema).max(40),
    broll: z.array(BRollSchema).max(2),
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
          hookText: { type: "string" },
          startTime: { type: "number" },
          endTime: { type: "number" },
          engagementScore: { type: "integer", minimum: 1, maximum: 100 },
          viralityReason: { type: "string" },
          fillerCuts: {
            type: "array",
            maxItems: 40,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                start: { type: "number" },
                end: { type: "number" },
              },
              required: ["start", "end"],
            },
          },
          broll: {
            type: "array",
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                query: { type: "string" },
                startTime: { type: "number" },
                duration: { type: "number" },
              },
              required: ["query", "startTime", "duration"],
            },
          },
        },
        required: [
          "title",
          "hookText",
          "startTime",
          "endTime",
          "engagementScore",
          "viralityReason",
          "fillerCuts",
          "broll",
        ],
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

function getAudioExtension(contentType: string, pathname: string) {
  const type = contentType.toLowerCase();
  if (type.includes("wav")) return "wav";
  if (type.includes("mp4") || type.includes("m4a")) return "m4a";
  if (type.includes("webm")) return "webm";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("flac")) return "flac";

  const match = pathname.match(/\.(mp3|wav|m4a|webm|ogg|flac|mp4|mpeg|mpga)$/i);
  return match?.[1]?.toLowerCase() ?? "mp3";
}

export async function POST(request: Request) {
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
    chunkStart: chunkStartValue,
  } = payload as {
    blobUrl?: unknown;
    prompt?: unknown;
    chunkStart?: unknown;
  };

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

  const chunkStartNumber = Number(chunkStartValue ?? 0);
  const chunkStart =
    Number.isFinite(chunkStartNumber) && chunkStartNumber > 0
      ? roundToHundredths(chunkStartNumber)
      : 0;

  let remoteResponse: Response;
  try {
    remoteResponse = await fetch(parsedUrl.toString(), {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return errorResponse("Could not download the uploaded file.", 400);
  }

  if (!remoteResponse.ok) {
    return errorResponse("Could not download the uploaded file.", 400);
  }

  const contentLength = Number(remoteResponse.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_SIZE) {
    return errorResponse(
      "The extracted audio is too large for this deployment. Try a shorter video.",
      413
    );
  }

  let remoteBlob: Blob;
  try {
    remoteBlob = await remoteResponse.blob();
  } catch {
    return errorResponse("Could not read the uploaded file.", 400);
  }

  if (remoteBlob.size === 0) {
    return errorResponse("The uploaded audio file is empty.", 400);
  }

  if (remoteBlob.size > MAX_AUDIO_SIZE) {
    return errorResponse(
      "The extracted audio is too large for this deployment. Try a shorter video.",
      413
    );
  }

  const fileExtension = getAudioExtension(remoteBlob.type, parsedUrl.pathname);
  const audioFile = new File(
    [remoteBlob],
    `uploaded-audio.${fileExtension}`,
    { type: remoteBlob.type || "audio/mpeg" }
  );

  const hasAudioExtension = /\.(mp3|wav|m4a|webm|ogg|flac|mp4|mpeg|mpga)$/i.test(
    audioFile.name
  );

  if (!audioFile.type.startsWith("audio/") && !hasAudioExtension) {
    return errorResponse("That file is not a supported audio file.", 400);
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
      timestamp_granularities: ["segment", "word"],
    });

    const transcriptWords = (transcription.words ?? [])
      .map((word) => ({
        word: word.word.trim(),
        start: roundToHundredths(Math.max(0, word.start)),
        end: roundToHundredths(Math.max(0, word.end)),
      }))
      .filter((word) => word.word.length > 0 && word.end > word.start);

    transcriptSegments = (transcription.segments ?? [])
      .map((segment) => {
        const start = roundToHundredths(Math.max(0, segment.start));
        const end = roundToHundredths(Math.max(0, segment.end));

        return {
          start,
          end,
          text: segment.text.trim(),
          words: transcriptWords.filter(
            (word) => word.end > start && word.start < end
          ),
        };
      })
      .filter((segment) => segment.text.length > 0 && segment.end > segment.start);

    if (chunkStart > 0) {
      transcriptSegments = transcriptSegments.map((segment) => ({
        ...segment,
        start: roundToHundredths(segment.start + chunkStart),
        end: roundToHundredths(segment.end + chunkStart),
        words: segment.words?.map((word) => ({
          ...word,
          start: roundToHundredths(word.start + chunkStart),
          end: roundToHundredths(word.end + chunkStart),
        })),
      }));
    }

    transcript = buildTranscript(transcriptSegments, transcription.text);
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
            "You are an expert short-form video editor. Analyze the transcript and select exactly 10 engaging, self-contained moments for TikTok, Reels, or Shorts. Each moment must start and end on a complete thought and be between 15 and 90 seconds long. For every clip, write a short, punchy on-screen hook of 3 to 6 words that earns attention in the first second. The hookText must be plain spoken-style text with no quotes, hashtags, emojis, or trailing punctuation. Rate each clip's engagement potential from 1 to 100 based on hook strength, pacing, emotional payoff, and shareability. For every clip, write a viralityReason: one concise sentence explaining the score, such as a strong emotional hook in the first 3 seconds or high shareability from a bold take. Also identify filler words (um, uh, like, you know), long awkward pauses, false starts, repeated takes, and obviously unusable takes inside each clip. Return those as fillerCuts with absolute source timestamps, not clip-relative timestamps. Keep filler cuts tight around the offending audio and never cut more than 40% of a clip. Suggest 0 to 2 B-roll overlays only when visuals would strengthen a moment. B-roll startTime must be relative to the clip start, duration must be 1 to 3 seconds, and query must be a short stock-video search term. Use only timestamps present in the transcript. Return JSON only.",
        },
        {
          role: "user",
          content: `User request:\n${prompt}\n\nTranscript with timestamps in seconds:\n${transcript}\n\nReturn exactly 10 clips. Each clip must have a short title, a 3-6 word hookText, startTime in seconds, endTime in seconds, a engagementScore from 1 to 100, a one-sentence viralityReason explaining the score, a fillerCuts array of absolute source-time ranges to remove, and a broll array with up to 2 short B-roll overlay suggestions. Use empty fillerCuts and broll arrays when nothing is useful.`,
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

        const clipDuration = endTime - startTime;
        const fillerCuts = moment.fillerCuts
          .map((range) => ({
            start: roundToHundredths(
              Math.max(startTime, Math.min(endTime, range.start))
            ),
            end: roundToHundredths(
              Math.max(startTime, Math.min(endTime, range.end))
            ),
          }))
          .filter(
            (range) =>
              range.end > range.start &&
              range.end - range.start >= 0.08 &&
              range.end - range.start <= clipDuration * 0.4
          )
          .sort((a, b) => a.start - b.start);
        const broll = moment.broll
          .map((suggestion) => {
            const brollStart = roundToHundredths(
              Math.min(Math.max(0, suggestion.startTime), Math.max(0, clipDuration - 1))
            );
            const brollDuration = roundToHundredths(
              Math.min(suggestion.duration, 3, clipDuration - brollStart)
            );

            return {
              query: suggestion.query.trim(),
              startTime: brollStart,
              duration: brollDuration,
            };
          })
          .filter((suggestion) => suggestion.query.length > 0 && suggestion.duration >= 1);

        return {
          id: randomUUID(),
          title: moment.title.trim(),
          hookText: moment.hookText.trim(),
          startTime,
          endTime,
          duration: roundToHundredths(clipDuration),
          engagementScore: moment.engagementScore,
          viralityReason: moment.viralityReason.trim(),
          fillerCuts,
          silenceCuts: findSilenceCuts(
            transcriptSegments,
            startTime,
            endTime
          ),
          removeFiller: true,
          broll,
          status: "pending" as const,
        };
      })
      .sort((a, b) => b.engagementScore - a.engagementScore);

    await Promise.all(
      clips.map(async (clip) => {
        if (!clip.broll?.length) return;

        clip.broll = (
          await Promise.all(
            clip.broll.map(async (suggestion) => ({
              ...suggestion,
              url: (await findPexelsBroll(suggestion.query)) ?? undefined,
            }))
          )
        ).filter((suggestion) => suggestion.url);
      })
    );

    return NextResponse.json({ clips, transcript: transcriptSegments });
  } catch (error) {
    console.error("[analyze] Moment detection failed", error);
    return errorResponse(
      "The AI service could not analyze this transcript. Please try again.",
      502
    );
  }
}
