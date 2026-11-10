import type {
  ProcessingOptions,
  TimeRange,
  TranscriptSegment,
  TranscriptWord,
} from '@/types/video';

const WHITE_COLOR = '&H00FFFFFF';
const WORDS_PER_LINE = 5;

type CaptionWord = {
  text: string;
  start: number;
  end: number;
};

type AssSubtitleInput = {
  transcript: TranscriptSegment[];
  clipStart: number;
  clipEnd: number;
  duration: number;
  cuts: TimeRange[];
  resolution: ProcessingOptions['resolution'];
  targetAspectRatio: ProcessingOptions['targetAspectRatio'];
  brandColor: string;
  brandFont: string;
  karaoke: boolean;
  hookText?: string;
  introText?: string;
  outroText?: string;
};

function toAssTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const centis = Math.floor((safe - Math.floor(safe)) * 100);
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(
    2,
    '0'
  )}.${String(centis).padStart(2, '0')}`;
}

function escapeAssText(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\r?\n/g, '\\N');
}

function hexToAssColor(hex: string) {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const safe = match ? match[1] : '3B82F6';
  const red = safe.slice(0, 2);
  const green = safe.slice(2, 4);
  const blue = safe.slice(4, 6);
  return `&H00${blue}${green}${red}`;
}

function mapTimeThroughCuts(time: number, cuts: TimeRange[]) {
  let removed = 0;

  for (const cut of cuts) {
    if (time <= cut.start) break;
    if (time < cut.end) {
      return Math.max(0, cut.start - removed);
    }
    removed += cut.end - cut.start;
  }

  return Math.max(0, time - removed);
}

function wordIsCut(word: TranscriptWord, clipStart: number, cuts: TimeRange[]) {
  const start = Math.max(0, word.start - clipStart);
  const end = Math.max(start, word.end - clipStart);

  return cuts.some((cut) => end > cut.start + 0.001 && start < cut.end - 0.001);
}

function chunkWords(words: CaptionWord[]) {
  const lines: CaptionWord[][] = [];

  for (let index = 0; index < words.length; index += WORDS_PER_LINE) {
    lines.push(words.slice(index, index + WORDS_PER_LINE));
  }

  return lines;
}

function buildCaptionLines(
  transcript: TranscriptSegment[],
  clipStart: number,
  clipEnd: number,
  duration: number,
  cuts: TimeRange[]
) {
  const lines: CaptionWord[][] = [];

  for (const segment of transcript) {
    if (segment.end <= clipStart || segment.start >= clipEnd) continue;

    const words = (segment.words ?? [])
      .filter(
        (word) =>
          word.end > clipStart &&
          word.start < clipEnd &&
          !wordIsCut(word, clipStart, cuts)
      )
      .map((word) => {
        const relativeStart = Math.max(0, Math.min(duration, word.start - clipStart));
        const relativeEnd = Math.max(
          relativeStart,
          Math.min(duration, word.end - clipStart)
        );

        return {
          text: word.word.trim(),
          start: mapTimeThroughCuts(relativeStart, cuts),
          end: mapTimeThroughCuts(relativeEnd, cuts),
        };
      })
      .filter((word) => word.text.length > 0 && word.end > word.start);

    if (segment.words?.length) {
      if (words.length > 0) {
        lines.push(...chunkWords(words));
      }
      continue;
    }

    const text = segment.text.trim().replace(/\s+/g, ' ');
    if (!text) continue;

    const relativeStart = Math.max(0, segment.start - clipStart);
    const relativeEnd = Math.min(duration, segment.end - clipStart);
    const start = mapTimeThroughCuts(relativeStart, cuts);
    const end = mapTimeThroughCuts(relativeEnd, cuts);

    if (end > start) {
      lines.push([{ text, start, end }]);
    }
  }

  return lines;
}

function buildKaraokeEvents(
  lines: CaptionWord[][],
  activeColor: string
) {
  const events: string[] = [];

  for (const line of lines) {
    line.forEach((word, index) => {
      const next = line[index + 1];
      const start = word.start;
      const end = next?.start ?? Math.max(word.end, start + 0.08);
      if (end <= start) return;

      const text = line
        .map((item, itemIndex) => {
          const escaped = escapeAssText(item.text);
          if (itemIndex !== index) return escaped;
          return `{\\c${activeColor}}${escaped}{\\c${WHITE_COLOR}&}`;
        })
        .join(' ');

      events.push(
        `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Brand,,0,0,0,,${text}`
      );
    });
  }

  return events;
}

function buildPlainEvents(lines: CaptionWord[][]) {
  return lines.map((line) => {
    const text = line.map((word) => escapeAssText(word.text)).join(' ');
    const start = line[0].start;
    const end = Math.max(line[line.length - 1].end, start + 0.08);
    return `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Brand,,0,0,0,,${text}`;
  });
}

export function buildKaraokeAss({
  transcript,
  clipStart,
  clipEnd,
  duration,
  cuts,
  resolution,
  targetAspectRatio,
  brandColor,
  brandFont,
  karaoke,
  hookText,
  introText,
  outroText,
}: AssSubtitleInput): string | null {
  const lines = buildCaptionLines(
    transcript,
    clipStart,
    clipEnd,
    duration,
    cuts
  );
  const hook = hookText?.trim();
  const intro = introText?.trim();
  const outro = outroText?.trim();

  if (lines.length === 0 && !hook && !intro && !outro) return null;

  const fontName = brandFont.replace(/[,\r\n]/g, ' ').trim() || 'Inter';
  const fontSize = resolution === '4K' ? 88 : 72;
  const marginV = targetAspectRatio === '9:16' ? 160 : 96;
  const playRes =
    targetAspectRatio === '16:9'
      ? { width: 1920, height: 1080 }
      : targetAspectRatio === '1:1'
        ? { width: 1080, height: 1080 }
        : { width: 1080, height: 1920 };
  const removedDuration = cuts.reduce(
    (total, cut) => total + (cut.end - cut.start),
    0
  );
  const outputDuration = Math.max(0.5, duration - removedDuration);

  const events = karaoke
    ? buildKaraokeEvents(lines, hexToAssColor(brandColor))
    : buildPlainEvents(lines);

  if (hook) {
    const hookFontSize = resolution === '4K' ? 116 : 92;
    events.unshift(
      `Dialogue: 2,${toAssTime(0)},${toAssTime(
        Math.min(3, outputDuration)
      )},Brand,,0,0,0,,{\\an5\\fs${hookFontSize}\\b1}${escapeAssText(hook)}`
    );
  }

  if (intro) {
    events.unshift(
      `Dialogue: 1,${toAssTime(0)},${toAssTime(
        Math.min(2.5, outputDuration)
      )},Brand,,0,0,0,,{\\an8}${escapeAssText(intro)}`
    );
  }

  if (outro) {
    const outroStart = Math.max(0, outputDuration - 2.5);
    events.push(
      `Dialogue: 1,${toAssTime(outroStart)},${toAssTime(
        outputDuration
      )},Brand,,0,0,0,,{\\an8}${escapeAssText(outro)}`
    );
  }

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 0',
    `PlayResX: ${playRes.width}`,
    `PlayResY: ${playRes.height}`,
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Brand,${fontName},${fontSize},&H00FFFFFF,&H00FFFFFF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,64,64,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}
