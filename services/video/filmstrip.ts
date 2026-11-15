export async function extractFrames(
  videoUrl: string,
  count = 12
): Promise<string[]> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return [];
  }

  const video = document.createElement("video");
  video.crossOrigin = "anonymous";
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error("Timed out loading the video.")),
        15000
      );
      video.onloadedmetadata = () => {
        window.clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        window.clearTimeout(timer);
        reject(new Error("The video could not be loaded."));
      };
      video.src = videoUrl;
      video.load();
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (!duration || !video.videoWidth || !video.videoHeight) return [];

    const frameCount = Math.max(2, Math.min(count, 15));
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 320 / video.videoWidth);
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return [];

    const frames: string[] = [];

    for (let index = 0; index < frameCount; index += 1) {
      const time = Math.min(
        duration * (index / frameCount) + 0.01,
        Math.max(duration - 0.05, 0)
      );

      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        };
        video.addEventListener("seeked", onSeeked);
        video.currentTime = time;
        window.setTimeout(() => {
          video.removeEventListener("seeked", onSeeked);
          resolve();
        }, 4000);
      });

      try {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL("image/jpeg", 0.6));
      } catch {
        // A frame can fail to draw for cross-origin videos; skip it.
      }
    }

    return frames;
  } catch (error) {
    console.warn("[filmstrip] Could not extract frames.", error);
    return [];
  } finally {
    video.onloadedmetadata = null;
    video.onerror = null;
    video.removeAttribute("src");
    video.load();
  }
}

export function formatTimecode(seconds: number) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const minutes = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  const frames = Math.floor((safe % 1) * 30);
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(
    2,
    "0"
  )}:${String(frames).padStart(2, "0")}`;
}
