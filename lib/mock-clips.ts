import type { Clip } from "@/lib/types";

const TITLES = [
  "The hook that stops the scroll",
  "Biggest surprise of the video",
  "Best quick tip",
  "The moment everything clicked",
  "Strongest opinion",
  "Funniest reaction",
  "Key takeaway in 30 seconds",
  "Behind-the-scenes confession",
  "The one mistake to avoid",
  "Closing line worth sharing",
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * MOCK. Simulates analysing the transcript and exporting 10 clips.
 * Later, swap the body for a real service (Shotstack, Remotion, FFmpeg worker)
 * and keep the same return shape so the UI does not change.
 */
export async function generateMockClips(options: {
  fileName: string;
  overlayText: string;
  format: string;
  resolution: string;
}): Promise<Clip[]> {
  await wait(3000);
  return TITLES.map((title, i) => ({
    id: `clip-${Date.now()}-${i + 1}`,
    url: `/mock/clip-${i + 1}.mp4`,
    title,
    duration: 18 + ((i * 7) % 33), // 18 to 50 seconds
    status: "completed" as const,
  }));
}
