import { randomUUID } from "crypto";
import OpenAI from "openai";
import { z } from "zod";
import { findPexelsBroll } from "@/lib/pexels";
import { findSilenceCuts } from "@/lib/silence";
import type { Clip, TranscriptSegment } from "@/types/video";

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

const ANALYSIS_RESPONSE_SCHEMA = {
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

function roundToHundredths(value: number) {
  return Math.round(value * 100) / 100;
}

function parseJsonContent(content: string): unknown {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  return JSON.parse(cleaned);
}

export function buildTranscriptText(segments: TranscriptSegment[]) {
  return segments
    .map(
      (segment) =>
        `[${segment.start.toFixed(2)}s - ${segment.end.toFixed(2)}s] ${segment.text.trim()}`
    )
    .join("\n");
}

export function offsetTranscriptSegments(
  segments: TranscriptSegment[],
  chunkStart: number
): TranscriptSegment[] {
  if (chunkStart <= 0) return segments;

  return segments.map((segment) => ({
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

export function segmentsFromTranscription(
  transcription: {
    text?: string;
    words?: Array<{ word: string; start: number; end: number }>;
    segments?: Array<{ start: number; end: number; text: string }>;
  }
): TranscriptSegment[] {
  const transcriptWords = (transcription.words ?? [])
    .map((word) => ({
      word: word.word.trim(),
      start: roundToHundredths(Math.max(0, word.start)),
      end: roundToHundredths(Math.max(0, word.end)),
    }))
    .filter((word) => word.word.length > 0 && word.end > word.start);

  return (transcription.segments ?? [])
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
    .filter(
      (segment) => segment.text.length > 0 && segment.end > segment.start
    );
}

const ANALYSIS_PROVIDERS = [
  {
    name: "Gemini",
    key: "GEMINI_API_KEY",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    model: "gemini-2.5-flash",
  },
  {
    name: "Cerebras",
    key: "CEREBRAS_API_KEY",
    baseURL: "https://api.cerebras.ai/v1",
    model: "llama-3.3-70b",
  },
  {
    name: "Groq",
    key: "GROQ_API_KEY",
    baseURL: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
  },
] as const;

const SYSTEM_PROMPT =
  "You are an expert short-form video editor. Analyze the transcript and select exactly 10 engaging, self-contained moments for TikTok, Reels, or Shorts. Each moment must start and end on a complete thought and be between 15 and 90 seconds long. For every clip, write a short, punchy on-screen hook of 3 to 6 words that earns attention in the first second. The hookText must be plain spoken-style text with no quotes, hashtags, emojis, or trailing punctuation. Rate each clip's engagement potential from 1 to 100 based on hook strength, pacing, emotional payoff, and shareability. For every clip, write a viralityReason: one concise sentence explaining the score, such as a strong emotional hook in the first 3 seconds or high shareability from a bold take. Also identify filler words (um, uh, like, you know), long awkward pauses, false starts, repeated takes, and obviously unusable takes inside each clip. Return those as fillerCuts with absolute source timestamps, not clip-relative timestamps. Keep filler cuts tight around the offending audio and never cut more than 40% of a clip. Suggest 0 to 2 B-roll overlays only when visuals would strengthen a moment. B-roll startTime must be relative to the clip start, duration must be 1 to 3 seconds, and query must be a short stock-video search term. Use only timestamps present in the transcript. Return JSON only.";

function providerErrorStatus(error: unknown) {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return undefined;
  }

  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

async function buildClips(
  moments: z.infer<typeof AnalysisSchema>["clips"],
  transcriptSegments: TranscriptSegment[]
): Promise<Clip[]> {
  const clips: Clip[] = moments
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
            Math.min(
              Math.max(0, suggestion.startTime),
              Math.max(0, clipDuration - 1)
            )
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
        .filter(
          (suggestion) =>
            suggestion.query.length > 0 && suggestion.duration >= 1
        );

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
        silenceCuts: findSilenceCuts(transcriptSegments, startTime, endTime),
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

  return clips;
}

export async function analyzeTranscript(
  transcript: string,
  prompt: string,
  transcriptSegments: TranscriptSegment[] = []
): Promise<Clip[]> {
  let lastError: unknown;

  for (let index = 0; index < ANALYSIS_PROVIDERS.length; index += 1) {
    const provider = ANALYSIS_PROVIDERS[index];
    const nextProvider = ANALYSIS_PROVIDERS[index + 1];
    const apiKey = process.env[provider.key];

    if (!apiKey) {
      console.warn(
        `[ai] ${provider.name} skipped: ${provider.key} is not configured.` +
          (nextProvider
            ? ` Falling back to ${nextProvider.name}.`
            : " No providers remain.")
      );
      lastError = new Error(`${provider.key} is not configured.`);
      continue;
    }

    try {
      const client = new OpenAI({ apiKey, baseURL: provider.baseURL });
      const completion = await client.chat.completions.create({
        model: provider.model,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${SYSTEM_PROMPT}
Return a JSON object matching this schema exactly:
${JSON.stringify(ANALYSIS_RESPONSE_SCHEMA)}`,
          },
          {
            role: "user",
            content: `User request:
${prompt}

Transcript with timestamps in seconds:
${transcript}

Return exactly 10 clips. Each clip must have a short title, a 3-6 word hookText, startTime in seconds, endTime in seconds, a engagementScore from 1 to 100, a one-sentence viralityReason explaining the score, a fillerCuts array of absolute source-time ranges to remove, and a broll array with up to 2 short B-roll overlay suggestions. Use empty fillerCuts and broll arrays when nothing is useful.`,
          },
        ],
      });

      const content = completion.choices[0]?.message?.content;
      if (typeof content !== "string" || content.trim().length === 0) {
        throw new Error("The provider returned an empty response.");
      }

      const validation = AnalysisSchema.safeParse(parseJsonContent(content));
      if (!validation.success) {
        throw new Error("The provider returned an incomplete clip list.");
      }

      return buildClips(validation.data.clips, transcriptSegments);
    } catch (error) {
      lastError = error;
      const status = providerErrorStatus(error);
      const fallbackMessage = nextProvider
        ? `Falling back to ${nextProvider.name}...`
        : "No providers remain.";

      if (status === 429) {
        console.warn(
          `[ai] ${provider.name} hit its rate limit (429). ${fallbackMessage}`
        );
      } else {
        console.warn(
          `[ai] ${provider.name} failed${status ? ` (${status})` : ""}. ${fallbackMessage}`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  console.error("[ai] All analysis providers failed.", lastError);
  throw new Error(
    "AI analysis is temporarily busy. Please try again in a minute."
  );
}
