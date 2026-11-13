import type { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

const FFMPEG_CORE_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm";

let ffmpegPromise: Promise<FFmpeg> | null = null;

function createFfmpeg() {
  return import("@ffmpeg/ffmpeg").then(async ({ FFmpeg }) => {
    const ffmpeg = new FFmpeg();

    console.log("Loading FFmpeg for audio extraction...");
    console.log("[ffmpeg] Core base URL:", FFMPEG_CORE_BASE_URL);

    try {
      await ffmpeg.load({
        coreURL: await toBlobURL(
          `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.js`,
          "text/javascript"
        ),
        wasmURL: await toBlobURL(
          `${FFMPEG_CORE_BASE_URL}/ffmpeg-core.wasm`,
          "application/wasm"
        ),
      });
    } catch (error) {
      console.error("FFmpeg failed to load:", error);
      throw new Error(
        `Could not load the audio engine. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    console.log("FFmpeg loaded. Writing file to FS...", {
      coreBaseUrl: FFMPEG_CORE_BASE_URL,
    });

    return ffmpeg;
  });
}

export function getFfmpeg() {
  if (!ffmpegPromise) {
    ffmpegPromise = createFfmpeg().catch((error) => {
      ffmpegPromise = null;
      throw error;
    });
  }

  return ffmpegPromise;
}

function createId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getExtension(fileName: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : "mp4";
}

function getBaseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "") || "video";
}

export async function extractAudio(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  if (typeof window === "undefined") {
    throw new Error("Audio extraction can only run in the browser.");
  }

  if (!file.type.startsWith("video/")) {
    throw new Error("Add a video file before extracting audio.");
  }

  let ffmpeg: FFmpeg;

  try {
    ffmpeg = await getFfmpeg();
  } catch (error) {
    console.error("Audio Extraction Failed:", error);
    throw error;
  }

  const id = createId();
  const inputName = `input-${id}.${getExtension(file.name)}`;
  const outputName = `audio-${id}.mp3`;

  const handleProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) {
      onProgress?.(Math.min(1, Math.max(0, progress)));
    }
  };

  ffmpeg.on("progress", handleProgress);

  const logLines: string[] = [];
  const handleLog = ({ message }: { message: string }) => {
    logLines.push(message);
    if (logLines.length > 100) logLines.shift();
  };
  ffmpeg.on("log", handleLog);

  try {
    console.log("Writing file to FS...", {
      name: inputName,
      type: file.type,
      size: file.size,
    });

    await ffmpeg.writeFile(inputName, await fetchFile(file));

    console.log("Running audio extraction command...");
    const exitCode = await ffmpeg.exec([
      "-i",
      inputName,
      "-vn",
      "-ar",
      "44100",
      "-ac",
      "1",
      "-b:a",
      "32k",
      outputName,
    ]);

    if (exitCode !== 0) {
      console.error(
        "[extract-audio] FFmpeg exited with code",
        exitCode,
        "\nLast log lines:\n" + logLines.slice(-30).join("\n")
      );
      throw new Error(
        `Audio extraction failed (FFmpeg code ${exitCode}). ${
          logLines.slice(-2).join(" | ") ||
          "This video may not have an audio track."
        }`
      );
    }

    const data = await ffmpeg.readFile(outputName);

    if (typeof data === "string" || data.byteLength === 0) {
      throw new Error("Audio extraction produced an empty file.");
    }

    onProgress?.(1);

    const audioBlob = new Blob([new Uint8Array(data)], { type: "audio/mpeg" });

    return new File(
      [audioBlob],
      `${getBaseName(file.name)}-audio.mp3`,
      { type: "audio/mpeg", lastModified: Date.now() }
    );
  } catch (error) {
    console.error("Audio Extraction Failed:", error);
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Audio extraction failed. Please try another video.");
  } finally {
    ffmpeg.off("progress", handleProgress);
    ffmpeg.off("log", handleLog);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}
