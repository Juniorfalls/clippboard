import type { TimeRange, TranscriptSegment } from "@/types/video";

const SILENCE_PADDING = 0.12;

export function findSilenceCuts(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  minSilence = 0.5
): TimeRange[] {
  const words = transcript
    .flatMap((segment) => segment.words ?? [])
    .filter(
      (word) =>
        word.end > word.start &&
        word.start >= clipStart &&
        word.end <= clipEnd
    )
    .sort((a, b) => a.start - b.start);

  const uniqueWords = words.filter((word, index) => {
    const previous = words[index - 1];
    return (
      !previous ||
      word.start > previous.start + 0.01 ||
      word.end > previous.end + 0.01
    );
  });

  const cuts: TimeRange[] = [];

  for (let index = 1; index < uniqueWords.length; index += 1) {
    const previous = uniqueWords[index - 1];
    const next = uniqueWords[index];
    const gap = next.start - previous.end;

    if (gap <= minSilence) continue;

    const start = Math.max(clipStart, previous.end + SILENCE_PADDING);
    const end = Math.min(clipEnd, next.start - SILENCE_PADDING);

    if (end - start < 0.1) continue;

    const lastCut = cuts[cuts.length - 1];
    if (lastCut && start <= lastCut.end + 0.02) {
      lastCut.end = Math.max(lastCut.end, end);
    } else {
      cuts.push({ start, end });
    }
  }

  return cuts;
}
