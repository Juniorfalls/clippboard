import { upload } from "@vercel/blob/client";
import type { AIAnalysisResult, IAIAnalyzer } from "@/types/video";

type ErrorResponse = { error?: string };

const MAX_AUDIO_SIZE = 24 * 1024 * 1024;

function getErrorMessage(data: unknown, fallback: string) {
  if (
    typeof data === "object" &&
    data !== null &&
    "error" in data &&
    typeof (data as ErrorResponse).error === "string"
  ) {
    return (data as ErrorResponse).error as string;
  }

  return fallback;
}

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "audio.mp3";
}

export class RealAIAnalyzer implements IAIAnalyzer {
  async analyze(
    audioFile: File,
    prompt: string,
    chunkStart = 0,
    processingOptions?: Record<string, unknown>
  ): Promise<AIAnalysisResult> {
    if (audioFile.size > MAX_AUDIO_SIZE) {
      throw new Error(
        "The extracted audio is too large for the analysis service. Try a shorter video."
      );
    }

    let blobUrl: string;

    try {
      const blob = await upload(
        `analysis/${Date.now()}-${safeFileName(audioFile.name)}`,
        audioFile,
        {
          access: "public",
          handleUploadUrl: "/api/upload",
          multipart: true,
          contentType: audioFile.type || "audio/mpeg",
        }
      );
      blobUrl = blob.url;
    } catch {
      throw new Error("Could not upload the extracted audio for analysis.");
    }

    let response: Response;

    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl,
          prompt,
          chunkStart,
          processingOptions,
        }),
      });
    } catch {
      throw new Error("Could not reach the analysis service. Check your connection.");
    }

    const data = (await response.json().catch(() => null)) as unknown;

    if (!response.ok) {
      throw new Error(
        getErrorMessage(
          data,
          `Video analysis failed (${response.status}). Please try again.`
        )
      );
    }

    if (
      typeof data !== "object" ||
      data === null ||
      !("clips" in data) ||
      !Array.isArray((data as AIAnalysisResult).clips)
    ) {
      throw new Error("The analysis service returned an invalid clip list.");
    }

    return data as AIAnalysisResult;
  }
}
