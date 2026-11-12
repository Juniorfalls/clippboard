import { trackFaces } from "@/lib/face-tracker";
import type { Clip } from "@/types/video";

const THUMBNAIL_WIDTH = 1280;
const THUMBNAIL_HEIGHT = 720;

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

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load image."));
    image.src = src;
  });
}

async function captureFrame(
  file: File,
  time: number
): Promise<HTMLCanvasElement | null> {
  const video = document.createElement("video");
  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;
  const objectUrl = URL.createObjectURL(file);
  video.src = objectUrl;

  try {
    await waitForEvent(video, "loadedmetadata");

    if (!video.videoWidth || !video.videoHeight) return null;

    const target = Math.min(
      Math.max(0, time),
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
        window.setTimeout(resolve, 80);
      });
    }

    const scale = Math.min(1, 1280 / video.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return null;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function wrapText(
  context: CanvasRenderingContext2D,
  words: string[],
  maxWidth: number
) {
  const lines: string[] = [];

  for (const word of words) {
    const current = lines[lines.length - 1];
    const candidate = current ? `${current} ${word}` : word;
    if (current && context.measureText(candidate).width > maxWidth) {
      lines.push(word);
    } else if (current) {
      lines[lines.length - 1] = candidate;
    } else {
      lines.push(word);
    }
  }

  return lines;
}

function fitHeadline(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
) {
  const words = text.trim().toUpperCase().split(/\s+/).filter(Boolean);
  const sizes = [112, 100, 90, 80, 70, 60, 52, 44];

  for (const size of sizes) {
    context.font = `900 ${size}px "Arial Black", "Inter", Arial, sans-serif`;
    const lines = wrapText(context, words, maxWidth);
    if (lines.length <= maxLines) return { size, lines };
  }

  context.font = '900 44px "Arial Black", "Inter", Arial, sans-serif';
  return { size: 44, lines: wrapText(context, words, maxWidth).slice(0, maxLines) };
}

export async function generateThumbnail(
  frameCanvas: HTMLCanvasElement,
  thumbnailText: string,
  faceCenterX = 0.5
): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_WIDTH;
  canvas.height = THUMBNAIL_HEIGHT;
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Could not create the thumbnail canvas.");

  const background = context.createLinearGradient(
    0,
    0,
    THUMBNAIL_WIDTH,
    THUMBNAIL_HEIGHT
  );
  background.addColorStop(0, "#3B82F6");
  background.addColorStop(1, "#2563EB");
  context.fillStyle = background;
  context.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

  context.fillStyle = "rgba(255, 215, 0, 0.18)";
  context.beginPath();
  context.arc(170, 610, 230, 0, Math.PI * 2);
  context.fill();

  const panelX = 620;
  const panelWidth = THUMBNAIL_WIDTH - panelX;
  const panelHeight = THUMBNAIL_HEIGHT;
  const sourceWidth = frameCanvas.width;
  const sourceHeight = frameCanvas.height;
  const targetRatio = panelWidth / panelHeight;

  let cropWidth = sourceHeight * targetRatio;
  let cropHeight = sourceHeight;
  if (cropWidth > sourceWidth) {
    cropWidth = sourceWidth;
    cropHeight = sourceWidth / targetRatio;
  }

  const centerX = Math.min(
    sourceWidth,
    Math.max(0, faceCenterX * sourceWidth)
  );
  const cropX = Math.min(
    Math.max(0, centerX - cropWidth / 2),
    Math.max(0, sourceWidth - cropWidth)
  );
  const cropY = Math.max(0, (sourceHeight - cropHeight) / 2);

  context.save();
  context.shadowColor = "rgba(28, 28, 28, 0.35)";
  context.shadowBlur = 30;
  context.fillStyle = "#1C1C1C";
  context.fillRect(panelX - 8, 0, panelWidth + 8, panelHeight);
  context.restore();
  context.drawImage(
    frameCanvas,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    panelX,
    0,
    panelWidth,
    panelHeight
  );

  const textWidth = 520;
  const textX = 65;
  const headline = fitHeadline(
    context,
    thumbnailText || "WATCH THIS",
    textWidth,
    3
  );
  const lineHeight = headline.size * 1.02;
  const textHeight = headline.lines.length * lineHeight;
  let textY = (THUMBNAIL_HEIGHT - textHeight) / 2 - 24;

  context.textBaseline = "top";
  context.textAlign = "left";
  context.lineJoin = "round";
  context.font = `900 ${headline.size}px "Arial Black", "Inter", Arial, sans-serif`;
  context.lineWidth = Math.max(8, headline.size * 0.12);
  context.strokeStyle = "#1C1C1C";
  context.shadowColor = "rgba(28, 28, 28, 0.45)";
  context.shadowBlur = 12;
  context.shadowOffsetY = 6;

  for (const line of headline.lines) {
    context.strokeText(line, textX, textY, textWidth);
    context.fillStyle = "#FFFFFF";
    context.fillText(line, textX, textY, textWidth);
    textY += lineHeight;
  }

  context.shadowColor = "transparent";
  context.shadowBlur = 0;
  context.shadowOffsetY = 0;

  try {
    const logo = await loadImage("/logo.png");
    context.globalAlpha = 0.9;
    context.drawImage(logo, textX, 608, 48, 48);
    context.globalAlpha = 1;
    context.font = '700 18px "Inter", Arial, sans-serif';
    context.fillStyle = "rgba(255, 255, 255, 0.9)";
    context.fillText("CLIPPBARD", textX + 60, 622);
  } catch {
    // The thumbnail still works without the brand mark.
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("The thumbnail could not be exported."));
      },
      "image/jpeg",
      0.9
    );
  });
}

export async function generateClipThumbnail(
  sourceFile: File,
  clip: Clip
): Promise<Blob | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null;
  }

  let faceCenterX = 0.5;
  let frameTime = clip.startTime + Math.min(2, clip.duration / 2);

  try {
    const track = await trackFaces(
      sourceFile,
      clip.startTime,
      clip.endTime,
      16
    );

    if (track?.bestTime != null) {
      frameTime = clip.startTime + track.bestTime;
      faceCenterX = track.bestCenterX ?? 0.5;
    }
  } catch (error) {
    console.warn(
      "[thumbnail] Face tracking failed; using the opening frame.",
      error
    );
  }

  const frame = await captureFrame(sourceFile, frameTime);
  if (!frame) return null;

  return generateThumbnail(
    frame,
    clip.thumbnailText || clip.hookText || clip.title,
    faceCenterX
  );
}
