import "@tensorflow/tfjs-backend-webgl";
import type { BlazeFaceModel, NormalizedFace } from "@tensorflow-models/blazeface";

export type FaceTrackPoint = {
  time: number;
  centerX: number;
  secondaryCenterX?: number;
  area?: number;
};

export type FaceTrack = {
  points: FaceTrackPoint[];
  width: number;
  height: number;
  bestTime: number | null;
  bestCenterX: number | null;
};

let modelPromise: Promise<BlazeFaceModel> | null = null;

async function getFaceModel(): Promise<BlazeFaceModel> {
  if (!modelPromise) {
    modelPromise = (async () => {
      const tf = await import("@tensorflow/tfjs");
      const blazeface = await import("@tensorflow-models/blazeface");

      try {
        await tf.setBackend("webgl");
      } catch {
        await tf.setBackend("cpu");
      }

      await tf.ready();

      try {
        return await blazeface.load({
          modelUrl: "/models/blazeface/model.json",
          maxFaces: 2,
          scoreThreshold: 0.5,
        });
      } catch (error) {
        console.warn(
          "[face-tracker] BlazeFace could not load; skipping face tracking.",
          error
        );
        throw error;
      }
    })().catch((error) => {
      modelPromise = null;
      throw error;
    });
  }

  return modelPromise;
}

function waitForEvent(target: EventTarget, event: string, timeout = 10000) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      target.removeEventListener(event, handleEvent);
      reject(new Error(`Timed out waiting for ${event}.`));
    }, timeout);

    function handleEvent() {
      window.clearTimeout(timer);
      target.removeEventListener(event, handleEvent);
      resolve();
    }

    target.addEventListener(event, handleEvent, { once: true });
  });
}

function readCoordinate(
  value: [number, number] | { dataSync: () => ArrayLike<number> }
): [number, number] {
  if (Array.isArray(value)) return value;

  const data = value.dataSync();
  return [Number(data[0]), Number(data[1])];
}

function getFaceCenter(face: NormalizedFace | undefined) {
  if (!face) return null;

  const [left, top] = readCoordinate(face.topLeft);
  const [right, bottom] = readCoordinate(face.bottomRight);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);

  return {
    centerX: (left + right) / 2,
    area: width * height,
  };
}

export async function trackFaces(
  file: File,
  startTime: number,
  endTime: number,
  maxSamples = 60
): Promise<FaceTrack | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  const duration = Math.max(0.1, endTime - startTime);
  const sampleCount = Math.min(
    Math.max(4, maxSamples),
    Math.max(8, Math.ceil(duration))
  );
  const interval = sampleCount > 1 ? duration / (sampleCount - 1) : duration;

  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  try {
    await waitForEvent(video, "loadedmetadata");

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return null;

    const canvas = document.createElement("canvas");
    const canvasWidth = Math.min(640, width);
    canvas.width = canvasWidth;
    canvas.height = Math.max(1, Math.round((height / width) * canvasWidth));
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return null;

    const model = await getFaceModel();
    const points: FaceTrackPoint[] = [];
    let bestFrame: { time: number; centerX: number; score: number } | null =
      null;

    for (let index = 0; index < sampleCount; index += 1) {
      const offset = Math.min(duration, index * interval);
      const target = Math.min(
        Math.max(0, startTime + offset),
        Math.max(0, video.duration - 0.05)
      );

      if (Math.abs(video.currentTime - target) > 0.001) {
        const seeked = waitForEvent(video, "seeked");
        video.currentTime = target;
        await seeked;
      }

      const withFrameCallback = video as HTMLVideoElement & {
        requestVideoFrameCallback?: (callback: () => void) => number;
      };

      if (withFrameCallback.requestVideoFrameCallback) {
        await new Promise<void>((resolve) => {
          withFrameCallback.requestVideoFrameCallback?.(() => resolve());
          window.setTimeout(resolve, 60);
        });
      }

      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const faces = await model.estimateFaces(canvas, false);
      const detectedFaces = faces
        .map((face) => getFaceCenter(face))
        .filter((face): face is { centerX: number; area: number } => Boolean(face))
        .sort((a, b) => b.area - a.area);

      const bestFace = detectedFaces[0];
      const secondaryFace = detectedFaces[1];

      if (bestFace) {
        const centerX = Math.min(
          1,
          Math.max(0, bestFace.centerX / canvas.width)
        );
        const centeredScore = 1 - Math.abs(centerX - 0.5);
        const score = bestFace.area * centeredScore;

        if (!bestFrame || score > bestFrame.score) {
          bestFrame = { time: offset, centerX, score };
        }

        points.push({
          time: offset,
          centerX,
          secondaryCenterX: secondaryFace
            ? Math.min(1, Math.max(0, secondaryFace.centerX / canvas.width))
            : undefined,
          area: bestFace.area,
        });
      }
    }

    if (points.length === 0) return null;
    points.sort((a, b) => a.time - b.time);

    const smoothed = points.map((point, index) => {
      const window = points.slice(Math.max(0, index - 1), index + 2);
      const centerX =
        window.reduce((sum, item) => sum + item.centerX, 0) / window.length;
      const secondaryValues = window
        .map((item) => item.secondaryCenterX)
        .filter((value): value is number => typeof value === "number");
      const secondaryCenterX =
        secondaryValues.length > 0
          ? secondaryValues.reduce((sum, value) => sum + value, 0) /
            secondaryValues.length
          : point.secondaryCenterX;

      return { time: point.time, centerX, secondaryCenterX };
    });

    return {
      points: smoothed,
      width,
      height,
      bestTime: bestFrame?.time ?? null,
      bestCenterX: bestFrame?.centerX ?? null,
    };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}
