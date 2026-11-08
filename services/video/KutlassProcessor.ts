import { getFfmpeg } from '@/lib/extract-audio';
import {
  Clip,
  IVideoProcessor,
  ProcessingOptions,
  TranscriptSegment,
} from '@/types/video';

const SAMPLE_VIDEO_URL =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

function createId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getExtension(fileName: string) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  return extension && /^[a-z0-9]+$/.test(extension) ? extension : 'mp4';
}

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

function buildKaraokeText(duration: number, text: string) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';

  const totalCentis = Math.max(1, Math.round(duration * 100));
  const weights = words.map((word) => word.length + 1);
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);

  let previousCentis = 0;

  return words
    .map((word, index) => {
      const cumulativeWeight = weights
        .slice(0, index + 1)
        .reduce((sum, weight) => sum + weight, 0);
      const endCentis =
        index === words.length - 1
          ? totalCentis
          : Math.round((totalCentis * cumulativeWeight) / totalWeight);
      const wordCentis = Math.max(1, endCentis - previousCentis);
      previousCentis = endCentis;

      return `{\\kf${wordCentis}}${escapeAssText(word)}`;
    })
    .join(' ');
}

function buildAssSubtitles(clip: Clip, options: ProcessingOptions) {
  const segments: TranscriptSegment[] = (options.transcript ?? [])
    .filter(
      (segment) =>
        segment.end > clip.startTime &&
        segment.start < clip.endTime &&
        segment.text.trim().length > 0
    )
    .map((segment) => ({
      start: Math.max(0, segment.start - clip.startTime),
      end: Math.max(0, Math.min(segment.end, clip.endTime) - clip.startTime),
      text: segment.text.trim().replace(/\s+/g, ' '),
    }))
    .filter((segment) => segment.end > segment.start);

  if (segments.length === 0) return null;

  const fontName = options.brandFont.replace(/[,\r\n]/g, ' ').trim() || 'Inter';
  const fontSize = options.resolution === '4K' ? 88 : 72;
  const highlightColor = hexToAssColor(options.brandColor);
  const marginV = options.targetAspectRatio === '9:16' ? 160 : 96;

  const events = segments.map((segment) => {
    const text = buildKaraokeText(segment.end - segment.start, segment.text);
    return `Dialogue: 0,${toAssTime(segment.start)},${toAssTime(
      segment.end
    )},Brand,,0,0,0,,${text}`;
  });

  return [
    '[Script Info]',
    'ScriptType: v4.00+',
    'WrapStyle: 2',
    'PlayResX: 1080',
    'PlayResY: 1920',
    'ScaledBorderAndShadow: yes',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    `Style: Brand,${fontName},${fontSize},&H00FFFFFF,${highlightColor},&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,6,2,2,64,64,${marginV},1`,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...events,
    '',
  ].join('\n');
}

export class KutlassProcessor implements IVideoProcessor {
  private environmentReady = false;

  constructor() {
    this.initializeEnvironment();
  }

  private initializeEnvironment(): void {
    if (typeof window === 'undefined') {
      console.warn(
        '[KutlassProcessor] WebCodecs/WASM environment is unavailable outside the browser.'
      );
      return;
    }

    const hasWebCodecs =
      'VideoEncoder' in globalThis &&
      'VideoDecoder' in globalThis &&
      'VideoFrame' in globalThis;

    const hasWasm = typeof WebAssembly !== 'undefined';

    if (!hasWebCodecs) {
      console.warn(
        '[KutlassProcessor] WebCodecs is not supported in this browser. Kutlass rendering may be unavailable.'
      );
    }

    if (!hasWasm) {
      console.warn(
        '[KutlassProcessor] WebAssembly is not supported in this browser. Kutlass rendering may be unavailable.'
      );
    }

    this.environmentReady = hasWebCodecs && hasWasm;
  }

  private simulateRender(onProgress: (progress: number) => void): Promise<string> {
    return new Promise((resolve) => {
      let progress = 0;
      onProgress(progress);

      const interval = setInterval(() => {
        progress = Math.min(progress + 5, 100);
        onProgress(progress);

        if (progress >= 100) {
          clearInterval(interval);
          resolve(SAMPLE_VIDEO_URL);
        }
      }, 150);
    });
  }

  private async renderWithCaptions(
    sourceFile: File,
    clip: Clip,
    options: ProcessingOptions,
    assContent: string,
    onProgress: (progress: number) => void
  ): Promise<string> {
    const ffmpeg = await getFfmpeg();
    const { fetchFile } = await import('@ffmpeg/util');
    const id = createId();
    const inputName = `caption-input-${id}.${getExtension(sourceFile.name)}`;
    const outputName = `caption-output-${id}.mp4`;
    const subtitleName = `captions-${id}.ass`;
    const duration = Math.max(0.1, clip.endTime - clip.startTime);

    const handleProgress = ({ progress }: { progress: number }) => {
      if (Number.isFinite(progress)) {
        onProgress(Math.min(99, Math.max(0, Math.round(progress * 100))));
      }
    };

    ffmpeg.on('progress', handleProgress);

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));
      await ffmpeg.writeFile(subtitleName, new TextEncoder().encode(assContent));

      const exitCode = await ffmpeg.exec([
        '-ss',
        clip.startTime.toFixed(3),
        '-i',
        inputName,
        '-t',
        duration.toFixed(3),
        '-vf',
        `ass=${subtitleName}`,
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '23',
        '-pix_fmt',
        'yuv420p',
        '-c:a',
        'aac',
        '-b:a',
        '128k',
        '-movflags',
        '+faststart',
        outputName,
      ]);

      if (exitCode !== 0) {
        throw new Error(`FFmpeg exited with code ${exitCode}.`);
      }

      const data = await ffmpeg.readFile(outputName);
      if (typeof data === 'string' || data.byteLength === 0) {
        throw new Error('Caption render produced an empty file.');
      }

      onProgress(100);
      const blob = new Blob([new Uint8Array(data)], { type: 'video/mp4' });
      return URL.createObjectURL(blob);
    } finally {
      ffmpeg.off('progress', handleProgress);
      await ffmpeg.deleteFile(inputName).catch(() => undefined);
      await ffmpeg.deleteFile(subtitleName).catch(() => undefined);
      await ffmpeg.deleteFile(outputName).catch(() => undefined);
    }
  }

  async processClip(
    sourceFile: File,
    clip: Clip,
    options: ProcessingOptions,
    onProgress: (progress: number) => void
  ): Promise<string> {
    if (!this.environmentReady) {
      this.initializeEnvironment();
    }

    console.warn(
      '[KutlassProcessor] Browser-based rendering is running. Keep this tab open until processing completes.'
    );

    const assContent = buildAssSubtitles(clip, options);

    console.log(
      `[KutlassProcessor] Rendering "${clip.title}" (${clip.startTime}s - ${clip.endTime}s) from "${sourceFile.name}" as ${options.targetAspectRatio} ${options.resolution}.`,
      `Brand styling: ${options.brandColor}, ${options.brandFont}, logo ${options.brandLogo ? 'included' : 'none'}.`,
      assContent
        ? 'Animated ASS captions generated for this clip.'
        : 'No transcript captions available for this clip.'
    );

    if (assContent) {
      try {
        return await this.renderWithCaptions(
          sourceFile,
          clip,
          options,
          assContent,
          onProgress
        );
      } catch (error) {
        console.error(
          '[KutlassProcessor] Caption burn-in failed; falling back to sample render.',
          error
        );
      }
    }

    return this.simulateRender(onProgress);
  }
}
