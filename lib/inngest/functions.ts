import { readFile } from "fs/promises";
import { put } from "@vercel/blob";
import OpenAI from "openai";
import { inngest } from "@/lib/inngest/client";
import {
  analyzeTranscript,
  buildTranscriptText,
  offsetTranscriptSegments,
  segmentsFromTranscription,
} from "@/lib/ai/video-analysis";
import {
  downloadVideoToTemp,
  extractAudioChunks,
  SERVER_AUDIO_CHUNK_SECONDS,
} from "@/lib/audio/server-chunks";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  videoProcessingChannel,
  type VideoProcessingUpdate,
} from "@/lib/inngest/realtime";
import type { TranscriptSegment } from "@/types/video";

type VideoProcessEvent = {
  jobId: string;
  blobUrl: string;
  prompt: string;
  userId: string;
  sourceName?: string;
  options?: Record<string, unknown>;
};

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
      message: "Uploading video...",
    });

    const audioChunks = await step.run("download-and-chunk-audio", async () => {
      console.log("[inngest] Step 2: Downloading video and extracting audio...", {
        jobId,
      });
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

    const transcriptionModel = "whisper-large-v3";
    const transcriptSegments: TranscriptSegment[] = [];

    for (const chunk of audioChunks) {
      await publishUpdate(jobId, {
        stage: "transcribing",
        message: `Transcribing chunk ${chunk.index + 1} of ${audioChunks.length}...`,
        chunk: chunk.index + 1,
        totalChunks: audioChunks.length,
        progress: Math.round((chunk.index / audioChunks.length) * 100),
      });

      const segments = await step.run(
        `transcribe-chunk-${chunk.index + 1}`,
        async () => {
          console.log(
            `[inngest] Step 3: Transcribing chunk ${chunk.index + 1} of ${audioChunks.length}...`,
            { jobId }
          );
          const response = await fetch(chunk.url, { cache: "no-store" });
          if (!response.ok) {
            throw new Error(`Could not download audio chunk ${chunk.index + 1}.`);
          }

          const buffer = Buffer.from(await response.arrayBuffer());
          const file = new File([buffer], `chunk-${chunk.index + 1}.mp3`, {
            type: "audio/mpeg",
          });
          const groq = groqTranscriptionClient();
          const transcription = await groq.audio.transcriptions.create({
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

    await publishUpdate(jobId, {
      stage: "analyzing",
      message: "Analyzing transcript...",
      progress: 80,
    });

    const clips = await step.run("find-clips", async () => {
      console.log("[inngest] Step 4: Analyzing transcript with free AI providers...", {
        jobId,
        segments: transcriptSegments.length,
      });

      return analyzeTranscript(transcript, prompt, transcriptSegments);
    });

    await step.run("save-clips", async () => {
      console.log("[inngest] Step 5: Saving clips to Supabase...", {
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
      console.log("[inngest] Step 6: Marking job as completed...", { jobId });
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

    await publishUpdate(jobId, {
      stage: "complete",
      message: "Complete!",
      progress: 100,
    });

    return { jobId, clipCount: clips.length };
  }
);

export const inngestFunctions = [processVideo];
