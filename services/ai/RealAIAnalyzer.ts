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

export class RealAIAnalyzer implements IAIAnalyzer {
  async analyze(
    audioFile: File,
    prompt: string,
    chunkStart = 0
  ): Promise<AIAnalysisResult> {
    if (audioFile.size > MAX_AUDIO_SIZE) {
      throw new Error(
        "The extracted audio is too large for the analysis service. Try a shorter video."
      );
    }

    const body = new FormData();
    body.append("audioFile", audioFile);
    body.append("prompt", prompt);
    body.append("chunkStart", String(chunkStart));

    let response: Response;

    try {
      response = await fetch("/api/analyze", {
        method: "POST",
        body,
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
