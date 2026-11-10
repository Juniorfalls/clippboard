import { createWriteStream } from "fs";
import { mkdtemp, readdir, rm } from "fs/promises";
import { tmpdir } from "os";
import { extname, join } from "path";
import { spawn } from "child_process";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import ffmpeg from "@ffmpeg-installer/ffmpeg";

const MAX_DOWNLOAD_BYTES = 2 * 1024 * 1024 * 1024;
export const SERVER_AUDIO_CHUNK_SECONDS = 10 * 60;

function safeExtension(value: string) {
  return /^\.(mp4|mov|webm|mkv|m4v)$/i.test(value) ? value.toLowerCase() : ".mp4";
}

function extensionFor(contentType: string, pathname: string) {
  const type = contentType.toLowerCase();
  if (type.includes("quicktime")) return ".mov";
  if (type.includes("webm")) return ".webm";
  if (type.includes("matroska")) return ".mkv";
  return safeExtension(extname(pathname));
}

export async function downloadVideoToTemp(blobUrl: string, jobId: string) {
  const response = await fetch(blobUrl, {
    cache: "no-store",
    signal: AbortSignal.timeout(120_000),
  });

  if (!response.ok || !response.body) {
    throw new Error("Could not download the uploaded video.");
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_DOWNLOAD_BYTES) {
    throw new Error("The uploaded video is too large for background processing.");
  }

  const workDir = await mkdtemp(join(tmpdir(), `clippboard-${jobId}-`));
  const videoPath = join(
    workDir,
    `source${extensionFor(
      response.headers.get("content-type") ?? "",
      new URL(blobUrl).pathname
    )}`
  );

  try {
    await pipeline(
      Readable.fromWeb(
        response.body as unknown as import("stream/web").ReadableStream
      ),
      createWriteStream(videoPath)
    );
  } catch (error) {
    await rm(workDir, { recursive: true, force: true });
    throw error;
  }

  return {
    workDir,
    videoPath,
    cleanup: () => rm(workDir, { recursive: true, force: true }),
  };
}

export async function extractAudioChunks(videoPath: string, workDir: string) {
  const pattern = join(workDir, "part-%03d.mp3");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(ffmpeg.path, [
      "-y",
      "-i",
      videoPath,
      "-vn",
      "-ac",
      "1",
      "-ar",
      "16000",
      "-codec:a",
      "libmp3lame",
      "-b:a",
      "64k",
      "-f",
      "segment",
      "-segment_time",
      String(SERVER_AUDIO_CHUNK_SECONDS),
      "-reset_timestamps",
      "1",
      pattern,
    ]);

    let stderr = "";
    child.stderr.on("data", (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-4000);
    });
    child.on("error", (error) => reject(error));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `Audio extraction failed (ffmpeg exited with code ${code}). ${stderr}`
        )
      );
    });
  });

  const files = (await readdir(workDir))
    .filter((name) => /^part-\d+\.mp3$/.test(name))
    .sort();

  if (files.length === 0) {
    throw new Error("No audio could be extracted from this video.");
  }

  return files.map((name) => join(workDir, name));
}
