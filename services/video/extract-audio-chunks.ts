import { getFfmpeg } from "@/lib/extract-audio";

export const AUDIO_CHUNK_SECONDS = 10 * 60;
const AUDIO_BITRATE = "64k";
const AUDIO_CHUNK_PREFIX = "clippboard-audio-part";

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
  return fileName.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-") || "video";
}

export async function extractAndChunkAudio(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File[]> {
  if (typeof window === "undefined") {
    throw new Error("Audio chunking can only run in the browser.");
  }

  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) {
    throw new Error("Add a video file before extracting audio.");
  }

  const ffmpeg = await getFfmpeg();
  const id = createId();
  const inputName = `chunk-source-${id}.${getExtension(file.name)}`;
  const outputPattern = `${AUDIO_CHUNK_PREFIX}-${id}-%03d.mp3`;
  const outputPrefix = `${AUDIO_CHUNK_PREFIX}-${id}-`;
  const chunkNames: string[] = [];

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
      "-codec:a",
      "libmp3lame",
      "-b:a",
      AUDIO_BITRATE,
      "-f",
      "segment",
      "-segment_time",
      String(AUDIO_CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      outputPattern,
    ]);

    if (exitCode !== 0) {
      throw new Error(
        "Audio extraction failed. This video may not contain an audio track."
      );
    }

    const entries = await ffmpeg.listDir("/");
    chunkNames.push(
      ...entries
        .filter(
          (entry) => !entry.isDir && entry.name.startsWith(outputPrefix)
        )
        .map((entry) => entry.name)
        .sort()
    );

    if (chunkNames.length === 0) {
      throw new Error("No audio chunks were produced from this video.");
    }

    const baseName = getBaseName(file.name);
    const chunks: File[] = [];

    for (const [index, name] of chunkNames.entries()) {
      const data = await ffmpeg.readFile(name);
      if (typeof data === "string" || data.byteLength === 0) {
        throw new Error(`Audio chunk ${index + 1} is empty.`);
      }

      chunks.push(
        new File([new Uint8Array(data)], `${baseName}-part-${index + 1}.mp3`, {
          type: "audio/mpeg",
          lastModified: Date.now(),
        })
      );
    }

    onProgress?.(1);
    return chunks;
  } finally {
    ffmpeg.off("progress", handleProgress);
    await ffmpeg.deleteFile(inputName).catch(() => undefined);
    await Promise.all(
      chunkNames.map((name) =>
        ffmpeg.deleteFile(name).catch(() => undefined)
      )
    );
  }
}
