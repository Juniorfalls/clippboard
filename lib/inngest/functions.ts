import OpenAI from "openai";
import { RetryAfterError } from "inngest";
import { inngest } from "@/lib/inngest/client";
import {
  ANALYSIS_PROVIDERS,
  analyzeTranscriptWithProvider,
  buildTranscriptText,
  segmentsFromTranscription,
} from "@/lib/ai/video-analysis";
import {
  isRateLimitError,
  withExponentialBackoff,
} from "@/lib/ai/rate-limit-handler";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  videoProcessingChannel,
  type VideoProcessingUpdate,
} from "@/lib/inngest/realtime";
import type { Clip, TranscriptSegment } from "@/types/video";

type VideoProcessEvent = {
  jobId: string;
  audioBlobUrl: string;
  prompt: string;
  userId: string;
  maxClips?: number;
  sourceName?: string;
  options?: Record<string, unknown>;
};

const MAX_GROQ_AUDIO_BYTES = 24 * 1024 * 1024;

function groqTranscriptionClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

const ANALYSIS_FALLBACK_CHAIN = [
  ANALYSIS_PROVIDERS[0],
  ANALYSIS_PROVIDERS[1],
  ANALYSIS_PROVIDERS[2],
] as const;

async function markJobAnalysisProcessing(jobId: string) {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("video_jobs")
      .update({
        status: "processing",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (error) throw error;
  } catch (error) {
    console.error("[ai] Could not mark job as processing", error);
  }
}

async function markJobWaitingForAi(jobId: string) {
  try {
    const admin = createAdminClient();
    const { error } = await admin
      .from("video_jobs")
      .update({
        status: "waiting_for_ai",
        error: "AI providers are rate limited. Retrying automatically.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    if (error) throw error;
  } catch (error) {
    console.error("[ai] Could not mark job as waiting for AI", error);
  }
}

export async function analyzeTranscriptWithFallback(
  transcript: string,
  prompt = "Find the 10 most engaging, self-contained moments in this transcript.",
  transcriptSegments: TranscriptSegment[] = [],
  jobId?: string,
  maxClips = 10
): Promise<Clip[]> {
  const clipLimit = Math.max(1, Math.min(10, Math.floor(maxClips)));
  let lastError: unknown;
  let sawRateLimit = false;
  let sawNonRateLimit = false;

  if (jobId) {
    await markJobAnalysisProcessing(jobId);
    await publishUpdate(jobId, {
      stage: "analyzing",
      message: "AI is finding the best moments...",
      progress: 75,
    });
  }

  for (let index = 0; index < ANALYSIS_FALLBACK_CHAIN.length; index += 1) {
    const provider = ANALYSIS_FALLBACK_CHAIN[index];
    const nextProvider = ANALYSIS_FALLBACK_CHAIN[index + 1];
    const apiKey = process.env[provider.key];

    if (!apiKey) {
      console.warn(
        `[ai] ${provider.name} skipped: ${provider.key} is not configured. ` +
          (nextProvider
            ? `Falling back to ${nextProvider.name}...`
            : "No providers remain.")
      );
      lastError = new Error(`${provider.key} is not configured.`);
      continue;
    }

    console.log(
      `[ai] Attempting ${provider.name} (${provider.model}) with exponential backoff...`
    );

    try {
      const clips = await withExponentialBackoff(
        () =>
          analyzeTranscriptWithProvider(
            provider,
            transcript,
            prompt,
            transcriptSegments,
            clipLimit
          ),
        {
          maxRetries: 3,
          baseDelayMs: 1_000,
          maxDelayMs: 32_000,
          label: `${provider.name} analysis`,
        }
      );

      console.log(`[ai] ${provider.name} analysis succeeded.`);
      return clips;
    } catch (error) {
      lastError = error;
      const rateLimited = isRateLimitError(error);
      if (rateLimited) {
        sawRateLimit = true;
      } else {
        sawNonRateLimit = true;
      }
      const fallbackMessage = nextProvider
        ? `Falling back to ${nextProvider.name}...`
        : "No providers remain.";

      if (provider.name === "OpenRouter" && rateLimited) {
        console.warn(
          "OpenRouter rate limit hit, falling back to Groq LLM..."
        );
      } else if (rateLimited) {
        console.warn(
          `[ai] ${provider.name} exhausted its retries after 429 rate limits. ${fallbackMessage}`
        );
      } else {
        console.warn(
          `[ai] ${provider.name} failed with a non-429 error. ${fallbackMessage}`,
          error instanceof Error ? error.message : error
        );
      }
    }
  }

  const allRateLimited = sawRateLimit && !sawNonRateLimit;

  if (allRateLimited) {
    console.warn(
      "[ai] All configured providers are rate limited. Asking Inngest to retry after 30s."
    );

    if (jobId) {
      await markJobWaitingForAi(jobId);
      await publishUpdate(jobId, {
        stage: "waiting_for_ai",
        message: "AI is busy, queued for retry...",
        progress: 75,
      });
    }

    throw new RetryAfterError(
      "AI rate limit hit, retrying...",
      "30s",
      { cause: lastError }
    );
  }

  console.error("[ai] All AI analysis providers failed.", lastError);

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error("AI analysis failed. Please try again.");
}

async function publishUpdate(
  jobId: string,
  update: Omit<VideoProcessingUpdate, "jobId">
) {
  try {
    await inngest.realtime.publish(videoProcessingChannel(jobId).status, {
      ...update,
      jobId,
    });
  } catch (error) {
    console.error("[inngest] Could not publish realtime update", error);
  }
}

export const processVideo = inngest.createFunction(
  {
    id: "process-video",
    name: "Process uploaded video",
    retries: 2,
    triggers: [{ event: "video/process.requested" }],
    onFailure: async ({ event, step }) => {
      const original = event.data.event as { data?: VideoProcessEvent };
      const jobId = original.data?.jobId;
      if (!jobId) return;

      await step.run("mark-job-failed", async () => {
        console.log("[inngest] Step: Marking job as failed...", { jobId });
        const admin = createAdminClient();
        const { error } = await admin
          .from("video_jobs")
          .update({
            status: "failed",
            error: event.data.error.message,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        if (error) throw error;
      });

      await publishUpdate(jobId, {
        stage: "failed",
        message: "Processing failed. Please try again.",
      });
    },
  },
  async ({ event, step }) => {
    const data = event.data as VideoProcessEvent;
    const {
      jobId,
      audioBlobUrl,
      prompt,
      userId,
      maxClips = 10,
      sourceName,
      options = {},
    } = data;

    if (!jobId || !audioBlobUrl || !prompt || !userId) {
      throw new Error("The video processing event is missing required data.");
    }

    await step.run("mark-job-processing", async () => {
      console.log("[inngest] Step 1: Marking job as processing...", { jobId });
      const admin = createAdminClient();
      const { error } = await admin.from("video_jobs").upsert(
        {
          id: jobId,
          user_id: userId,
          status: "processing",
          prompt,
          source_name: sourceName ?? null,
          options,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );

      if (error) throw error;
    });

    await publishUpdate(jobId, {
      stage: "uploading",
      message: "Uploading secure audio...",
    });

    await publishUpdate(jobId, {
      stage: "transcribing",
      message: "AI is transcribing your video...",
      progress: 25,
    });

    const transcriptSegments = await step.run("transcribe-audio", async () => {
      console.log(
        "[inngest] Step 2: Sending uploaded audio directly to Groq Whisper...",
        { jobId }
      );

      const response = await fetch(audioBlobUrl, {
        cache: "no-store",
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) {
        throw new Error("Could not download the uploaded audio.");
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      if (buffer.byteLength === 0) {
        throw new Error("The uploaded audio file is empty.");
      }
      if (buffer.byteLength > MAX_GROQ_AUDIO_BYTES) {
        throw new Error(
          "The extracted audio is too large for transcription. Try a video under 90 minutes."
        );
      }

      const file = new File([buffer], `audio-${jobId}.mp3`, {
        type: "audio/mpeg",
      });
      const groq = groqTranscriptionClient();
      const transcription = await groq.audio.transcriptions.create({
        file,
        model: "whisper-large-v3",
        response_format: "verbose_json",
        timestamp_granularities: ["segment", "word"],
      });

      return segmentsFromTranscription(transcription);
    });

    transcriptSegments.sort((a, b) => a.start - b.start);
    const transcript = buildTranscriptText(transcriptSegments);

    if (!transcript) {
      throw new Error(
        "No speech was detected in this video. Try a video with narration."
      );
    }

    await publishUpdate(jobId, {
      stage: "analyzing",
      message: "AI is finding the best moments...",
      progress: 75,
    });

    const clips = await step.run("find-clips", async () => {
      console.log(
        "[inngest] Step 3: Analyzing transcript with free AI providers...",
        {
          jobId,
          segments: transcriptSegments.length,
        }
      );

      return analyzeTranscriptWithFallback(
        transcript,
        prompt,
        transcriptSegments,
        jobId,
        maxClips
      );
    });

    if (clips.length === 0) {
      const message = "No engaging moments found in this video.";

      await step.run("mark-job-no-clips", async () => {
        console.log("[inngest] No clips found. Marking job as failed...", {
          jobId,
        });
        const admin = createAdminClient();
        const { error } = await admin
          .from("video_jobs")
          .update({
            status: "failed",
            error: message,
            transcript: transcriptSegments,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);

        if (error) throw error;
      });

      await publishUpdate(jobId, {
        stage: "failed",
        message,
      });

      return { jobId, clipCount: 0 };
    }

    await step.run("save-clips", async () => {
      console.log("[inngest] Step 4: Saving clips to Supabase...", {
        jobId,
        clips: clips.length,
      });
      const admin = createAdminClient();

      const { error: deleteError } = await admin
        .from("clips")
        .delete()
        .eq("job_id", jobId);
      if (deleteError) throw deleteError;

      const now = new Date().toISOString();
      const { error: insertError } = await admin.from("clips").insert(
        clips.map((clip) => ({
          id: clip.id,
          user_id: userId,
          job_id: jobId,
          title: clip.title,
          duration: clip.duration,
          engagement_score: clip.engagementScore,
          start_time: clip.startTime,
          end_time: clip.endTime,
          hook_text: clip.hookText,
          virality_reason: clip.viralityReason,
          status: "ready",
          metadata: clip,
          created_at: now,
          updated_at: now,
        }))
      );

      if (insertError) throw insertError;
    });

    await step.run("mark-job-completed", async () => {
      console.log("[inngest] Step 5: Marking job as completed...", { jobId });
      const admin = createAdminClient();
      const { error } = await admin
        .from("video_jobs")
        .update({
          status: "completed",
          error: null,
          transcript: transcriptSegments,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    });

    await publishUpdate(jobId, {
      stage: "complete",
      message: "Complete!",
      progress: 100,
    });

    return { jobId, clipCount: clips.length };
  }
);

export const inngestFunctions = [processVideo];
