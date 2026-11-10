import { readFile } from "fs/promises";
import { put } from "@vercel/blob";
import OpenAI from "openai";
import { inngest } from "@/lib/inngest/client";
import {
  buildTranscriptText,
  findClipsFromTranscript,
  offsetTranscriptSegments,
  segmentsFromTranscription,
} from "@/lib/ai/video-analysis";
import {
  downloadVideoToTemp,
  extractAudioChunks,
  SERVER_AUDIO_CHUNK_SECONDS,
} from "@/lib/audio/server-chunks";
import { createAdminClient } from "@/utils/supabase/admin";
import type { TranscriptSegment } from "@/types/video";

type VideoProcessEvent = {
  jobId: string;
  blobUrl: string;
  prompt: string;
  userId: string;
  sourceName?: string;
  options?: Record<string, unknown>;
};

function openaiClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  return new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL,
  });
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
    },
  },
  async ({ event, step }) => {
    const data = event.data as VideoProcessEvent;
    const {
      jobId,
      blobUrl,
      prompt,
      userId,
      sourceName,
      options = {},
    } = data;

    if (!jobId || !blobUrl || !prompt || !userId) {
      throw new Error("The video processing event is missing required data.");
    }

    await step.run("mark-job-processing", async () => {
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

    const audioChunks = await step.run("download-and-chunk-audio", async () => {
      const download = await downloadVideoToTemp(blobUrl, jobId);

      try {
        const chunkPaths = await extractAudioChunks(
          download.videoPath,
          download.workDir
        );
        const uploaded: Array<{ index: number; url: string }> = [];

        for (const [index, chunkPath] of chunkPaths.entries()) {
          const buffer = await readFile(chunkPath);
          const blob = await put(
            `analysis/${userId}/${jobId}/chunk-${index}.mp3`,
            buffer,
            {
              access: "public",
              contentType: "audio/mpeg",
              addRandomSuffix: true,
            }
          );
          uploaded.push({ index, url: blob.url });
        }

        return uploaded;
      } finally {
        await download.cleanup();
      }
    });

    const transcriptionModel =
      process.env.OPENAI_TRANSCRIBE_MODEL ?? "whisper-1";
    const transcriptSegments: TranscriptSegment[] = [];

    for (const chunk of audioChunks) {
      const segments = await step.run(
        `transcribe-chunk-${chunk.index + 1}`,
        async () => {
          const response = await fetch(chunk.url, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`Could not download audio chunk ${chunk.index + 1}.`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          const file = new File([buffer], `chunk-${chunk.index + 1}.mp3`, {
            type: "audio/mpeg",
          });
          const openai = openaiClient();
          const transcription = await openai.audio.transcriptions.create({
            file,
            model: transcriptionModel,
            response_format: "verbose_json",
            timestamp_granularities: ["segment", "word"],
          });

          return offsetTranscriptSegments(
            segmentsFromTranscription(transcription),
            chunk.index * SERVER_AUDIO_CHUNK_SECONDS
          );
        }
      );

      transcriptSegments.push(...segments);
    }

    transcriptSegments.sort((a, b) => a.start - b.start);
    const transcript = buildTranscriptText(transcriptSegments);

    if (!transcript) {
      throw new Error(
        "No speech was detected in this video. Try a video with narration."
      );
    }

    const clips = await step.run("find-clips", async () => {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      return findClipsFromTranscript({
        transcript,
        transcriptSegments,
        prompt,
        apiKey,
        baseURL: process.env.OPENAI_BASE_URL,
        model: process.env.OPENAI_MODEL ?? "gpt-4o",
      });
    });

    await step.run("save-clips", async () => {
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
      const admin = createAdminClient();
      const { error } = await admin
        .from("video_jobs")
        .update({
          status: "completed",
          transcript: transcriptSegments,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;
    });

    return { jobId, clipCount: clips.length };
  }
);

export const inngestFunctions = [processVideo];
