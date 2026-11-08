import type { FFmpeg } from "@ffmpeg/ffmpeg";

const FFMPEG_CORE_BASE_URL =
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let ffmpegPromise: Promise<FFmpeg> | null = null;

function createFfmpeg() {
  return import("@ffmpeg/ffmpeg").then(async ({ FFmpeg }) => {
    const { toBlobURL } = await import("@ffmpeg/util");
    const ffmpeg = new FFmpeg();

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

  const ffmpeg = await getFfmpeg();
  const id = createId();
  const inputName = `input-${id}.${getExtension(file.name)}`;
  const outputName = `audio-${id}.mp3`;

  const handleProgress = ({ progress }: { progress: number }) => {
    if (Number.isFinite(progress)) {
      onProgress?.(Math.min(1, Math.max(0, progress)));
    }
  };

  ffmpeg.on("progress", handleProgress);

  try {
    const { fetchFile } = await import("@ffmpeg/util");
    await ffmpeg.writeFile(inputName, await fetchFile(file));

    const exitCode = await ffmpeg.exec([
      "-i",
      inputName,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-b:a",
      "32k",
      "-codec:a",
      "libmp3lame",
      outputName,
    ]);

    if (exitCode !== 0) {
      throw new Error("Audio extraction failed. This video may not have an audio track.");
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
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Audio extraction failed. Please try another video.");
  } finally {
    ffmpeg.off("progress", handleProgress);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await ffmpeg.deleteFile(outputName).catch(() => undefined);
  }
}
