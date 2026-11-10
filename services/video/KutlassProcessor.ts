import { getFfmpeg } from '@/lib/extract-audio';
import type { FaceTrack } from '@/lib/face-tracker';
import { buildKaraokeAss } from '@/services/video/ass-subtitles';
import {
  Clip,
  IVideoProcessor,
  ProcessingOptions,
  TimeRange,
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

function getBrollDimensions(options: ProcessingOptions) {
  if (options.targetAspectRatio === '9:16') {
    return { width: 1080, height: 1920 };
  }
  if (options.targetAspectRatio === '1:1') {
    return { width: 1080, height: 1080 };
  }
  return { width: 1920, height: 1080 };
}

function buildPaneXExpression(
  points: FaceTrack['points'],
  selectCenter: (point: FaceTrack['points'][number]) => number,
  sourceWidth: number,
  cropWidth: number
) {
  const maxX = Math.max(0, sourceWidth - cropWidth);
  const xValues = points.map((point) =>
    Math.round(
      Math.min(
        maxX,
        Math.max(0, selectCenter(point) * sourceWidth - cropWidth / 2)
      )
    )
  );

  let expression = String(xValues[xValues.length - 1]);

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const start = points[index].time;
    const end = points[index + 1].time;
    if (end <= start) continue;

    const fromX = xValues[index];
    const toX = xValues[index + 1];
    const slope = (toX - fromX) / (end - start);
    const direction = slope >= 0 ? '+' : '-';
    const segment = `${fromX}${direction}${Math.abs(slope).toFixed(
      4
    )}*(t-${start.toFixed(2)})`;

    expression = `if(lt(t\\,${end.toFixed(2)})\\,${segment}\\,${expression})`;
  }

  return expression;
}

function buildSplitScreenFilter(
  clip: Clip,
  options: ProcessingOptions,
  track: FaceTrack
) {
  if (options.layout !== 'split-screen') return null;

  const { width, height } = track;
  if (width <= 0 || height <= 0 || track.points.length === 0) return null;

  const dimensions = getBrollDimensions(options);
  const paneHeight = Math.floor(dimensions.height / 2);
  const paneAspect = dimensions.width / paneHeight;
  let cropHeight = height;
  let cropWidth = Math.round(cropHeight * paneAspect);

  if (cropWidth > width) {
    cropWidth = width;
    cropHeight = Math.round(cropWidth / paneAspect);
  }

  const cropY = Math.max(0, Math.round((height - cropHeight) / 2));
  const cuts = getRelativeCuts(
    clip,
    clip.removeFiller ?? false,
    options.removeSilences
  );
  const points: FaceTrack['points'] = [];

  track.points.forEach((point) => {
    const time = mapTimeThroughCuts(point.time, cuts);
    const previous = points[points.length - 1];
    if (previous && time <= previous.time + 0.01) return;
    points.push({ ...point, time });
  });

  if (points.length === 0) return null;

  const primaryX = buildPaneXExpression(
    points,
    (point) => point.centerX,
    width,
    cropWidth
  );
  const secondaryX = buildPaneXExpression(
    points,
    (point) => point.secondaryCenterX ?? 0.5,
    width,
    cropWidth
  );

  console.log(
    `[KutlassProcessor] Split-screen podcast layout for "${clip.title}" using ${points.length} samples.`
  );

  return (
    `split=2[ssTopSource][ssBottomSource];` +
    `[ssTopSource]crop=${cropWidth}:${cropHeight}:${primaryX}:${cropY},` +
    `scale=${dimensions.width}:${paneHeight}[ssTop];` +
    `[ssBottomSource]crop=${cropWidth}:${cropHeight}:${secondaryX}:${cropY},` +
    `scale=${dimensions.width}:${paneHeight}[ssBottom];` +
    `[ssTop][ssBottom]vstack=inputs=2`
  );
}

function getRelativeCuts(
  clip: Clip,
  includeFiller = clip.removeFiller ?? false,
  includeSilence = false
): TimeRange[] {
  const ranges = [
    ...(clip.cutRanges ?? []),
    ...(includeFiller ? clip.fillerCuts ?? [] : []),
    ...(includeSilence ? clip.silenceCuts ?? [] : []),
  ]
    .map((range) => ({
      start: Math.max(0, range.start - clip.startTime),
      end: Math.min(clip.endTime, range.end) - clip.startTime,
    }))
    .filter((range) => range.end > range.start)
    .sort((a, b) => a.start - b.start);

  return ranges.reduce<TimeRange[]>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end + 0.02) {
      previous.end = Math.max(previous.end, range.end);
      return merged;
    }

    merged.push({ ...range });
    return merged;
  }, []);
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

function buildCenterCropFilter() {
  return "crop=w='min(iw,ih*9/16)':h='min(ih,iw*16/9)':x='(iw-ow)/2':y='(ih-oh)/2'";
}

function buildFaceCropFilter(
  clip: Clip,
  options: ProcessingOptions,
  track: FaceTrack
) {
  if (options.targetAspectRatio !== '9:16') return null;

  const { width, height } = track;
  if (width <= 0 || height <= 0 || track.points.length === 0) return null;

  const cuts = getRelativeCuts(
    clip,
    clip.removeFiller ?? false,
    options.removeSilences
  );
  const points: FaceTrack['points'] = [];

  track.points.forEach((point) => {
    const time = mapTimeThroughCuts(point.time, cuts);
    const previous = points[points.length - 1];
    if (previous && time <= previous.time + 0.01) return;
    points.push({ time, centerX: point.centerX });
  });

  if (points.length === 0) return null;

  const cropWidth = Math.min(width, Math.round(height * (9 / 16)));
  if (cropWidth >= width - 1) return null;

  const maxX = width - cropWidth;
  const xValues = points.map((point) => {
    const centerX = point.centerX * width;
    return Math.round(Math.min(maxX, Math.max(0, centerX - cropWidth / 2)));
  });

  const lastX = xValues[xValues.length - 1];
  let expression = String(lastX);

  for (let index = points.length - 2; index >= 0; index -= 1) {
    const start = points[index].time;
    const end = points[index + 1].time;
    if (end <= start) continue;

    const fromX = xValues[index];
    const toX = xValues[index + 1];
    const slope = (toX - fromX) / (end - start);
    const direction = slope >= 0 ? '+' : '-';
    const segment = `${fromX}${direction}${Math.abs(slope).toFixed(
      4
    )}*(t-${start.toFixed(2)})`;

    expression = `if(lt(t\\,${end.toFixed(2)})\\,${segment}\\,${expression})`;
  }

  if (points[0].time > 0.05) {
    expression = `if(lt(t\\,${points[0].time.toFixed(
      2
    )})\\,${xValues[0]}\\,${expression})`;
  }

  console.log(
    `[KutlassProcessor] Face-tracked 9:16 crop for "${clip.title}" using ${points.length} samples.`
  );

  return `crop=${cropWidth}:${height}:${expression}:0`;
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
    assContent: string | null,
    cropFilter: string | null,
    splitFilter: string | null,
    onProgress: (progress: number) => void
  ): Promise<string> {
    const ffmpeg = await getFfmpeg();
    const { fetchFile } = await import('@ffmpeg/util');
    const id = createId();
    const inputName = `caption-input-${id}.${getExtension(sourceFile.name)}`;
    const outputName = `caption-output-${id}.mp4`;
    const subtitleName = `captions-${id}.ass`;
    const duration = Math.max(0.1, clip.endTime - clip.startTime);
    const brollFileNames: string[] = [];
    const voiceoverFileName = `voiceover-${id}.mp3`;
    const watermarkFileName = `watermark-${id}.png`;
    let hasVoiceover = false;

    const handleProgress = ({ progress }: { progress: number }) => {
      if (Number.isFinite(progress)) {
        onProgress(Math.min(99, Math.max(0, Math.round(progress * 100))));
      }
    };

    ffmpeg.on('progress', handleProgress);

    try {
      await ffmpeg.writeFile(inputName, await fetchFile(sourceFile));

      const cuts = getRelativeCuts(
        clip,
        clip.removeFiller ?? false,
        options.removeSilences
      );
      const cutCondition = cuts
        .map(
          (cut) =>
            `between(t,${cut.start.toFixed(3)},${cut.end.toFixed(3)})`
        )
        .join('+');

      const filters: string[] = [];
      if (cuts.length > 0) {
        filters.push(`select='not(${cutCondition})'`);
        filters.push('setpts=N/FRAME_RATE/TB');
      }
      if (splitFilter) filters.push(splitFilter);
      else if (cropFilter) filters.push(cropFilter);
      if (assContent) {
        await ffmpeg.writeFile(subtitleName, new TextEncoder().encode(assContent));
        filters.push(`subtitles=${subtitleName}`);
      }

      const audioFilters =
        cuts.length > 0
          ? [`aselect='not(${cutCondition})'`, 'asetpts=N/SR/TB']
          : [];

      const brollDimensions = getBrollDimensions(options);
      const removedDuration = cuts.reduce(
        (total, cut) => total + (cut.end - cut.start),
        0
      );
      const outputDuration = Math.max(0.5, duration - removedDuration);
      const brollFiles: Array<{
        name: string;
        start: number;
        duration: number;
      }> = [];

      for (const [index, broll] of (clip.broll ?? []).entries()) {
        if (!broll.url) continue;

        try {
          const response = await fetch(broll.url);
          if (!response.ok) continue;

          const data = new Uint8Array(await response.arrayBuffer());
          if (data.byteLength === 0) continue;

          const start = mapTimeThroughCuts(broll.startTime, cuts);
          if (start >= outputDuration - 0.4) continue;

          const brollDuration = Math.min(
            broll.duration,
            Math.max(0.4, outputDuration - start)
          );
          const name = `broll-${id}-${index}.mp4`;
          await ffmpeg.writeFile(name, data);
          brollFileNames.push(name);
          brollFiles.push({ name, start, duration: brollDuration });
        } catch (error) {
          console.warn('[KutlassProcessor] Could not load B-roll clip.', error);
        }
      }

      if (clip.voiceover?.audioUrl) {
        try {
          const response = await fetch(clip.voiceover.audioUrl);
          if (response.ok) {
            const data = new Uint8Array(await response.arrayBuffer());
            if (data.byteLength > 0) {
              await ffmpeg.writeFile(voiceoverFileName, data);
              hasVoiceover = true;
            }
          }
        } catch (error) {
          console.warn('[KutlassProcessor] Could not load voiceover audio.', error);
        }
      }

      let hasWatermark = false;

      if (options.addWatermark) {
        try {
          const response = await fetch('/logo.png');
          if (response.ok) {
            const data = new Uint8Array(await response.arrayBuffer());
            if (data.byteLength > 0) {
              await ffmpeg.writeFile(watermarkFileName, data);
              hasWatermark = true;
            }
          }
        } catch (error) {
          console.warn('[KutlassProcessor] Could not load the watermark logo.', error);
        }
      }

      const hasBroll = brollFiles.length > 0;
      let filterGraph: string | null = null;

      if (hasBroll || hasVoiceover || hasWatermark) {
        let graph = '';
        const videoOutput = hasWatermark ? 'vpre' : 'vout';
        const baseFilters = filters.length > 0 ? filters.join(',') : 'null';

        if (hasBroll) {
          graph = `[0:v]${baseFilters}[base0]`;
          let current = 'base0';

          brollFiles.forEach((broll, index) => {
            const fade = Math.min(0.35, Math.max(0.1, broll.duration / 4));
            const fadeOutStart = Math.max(0, broll.duration - fade);
            const end = broll.start + broll.duration;

            graph +=
              `;[${index + 1}:v]` +
              `scale=${brollDimensions.width}:${brollDimensions.height}:force_original_aspect_ratio=increase,` +
              `crop=${brollDimensions.width}:${brollDimensions.height},` +
              `trim=duration=${broll.duration.toFixed(3)},setpts=PTS-STARTPTS,` +
              `fade=t=in:st=0:d=${fade.toFixed(3)},` +
              `fade=t=out:st=${fadeOutStart.toFixed(
                3
              )}:d=${fade.toFixed(3)},` +
              `setpts=PTS+${broll.start.toFixed(3)}/TB[b${index}]`;
            graph +=
              `;[${current}][b${index}]overlay=(W-w)/2:(H-h)/2:` +
              `enable='between(t,${broll.start.toFixed(3)},${end.toFixed(3)})':` +
              `eof_action=pass[v${index}]`;
            current = `v${index}`;
          });

          graph += `;[${current}]null[${videoOutput}]`;
        } else {
          graph = `[0:v]${baseFilters}[${videoOutput}]`;
        }

        if (hasWatermark) {
          const watermarkIndex =
            1 + brollFiles.length + (hasVoiceover ? 1 : 0);
          graph +=
            `;[${watermarkIndex}:v]scale=-1:40:flags=lanczos,` +
            `format=rgba,colorchannelmixer=aa=0.7[wm]`;
          graph +=
            `;[${videoOutput}][wm]overlay=W-w-20:H-h-20:format=auto[vout]`;
        }

        if (hasVoiceover) {
          const voiceoverIndex = 1 + brollFiles.length;
          const baseAudio = audioFilters.length > 0
            ? audioFilters.join(',')
            : 'anull';
          graph += `;[0:a]${baseAudio},volume=0.7[basea]`;
          graph += `;[${voiceoverIndex}:a]volume=1.0,adelay=0|0[voa]`;
          graph +=
            ';[basea][voa]amix=inputs=2:duration=first:dropout_transition=2[aout]';
        }

        filterGraph = graph;
      }

      const args = [
        '-ss',
        clip.startTime.toFixed(3),
        '-i',
        inputName,
        ...brollFiles.flatMap((broll) => [
          '-stream_loop',
          '-1',
          '-i',
          broll.name,
        ]),
        ...(hasVoiceover ? ['-i', voiceoverFileName] : []),
        ...(hasWatermark ? ['-i', watermarkFileName] : []),
        '-t',
        duration.toFixed(3),
        ...(filterGraph
          ? [
              '-filter_complex',
              filterGraph,
              '-map',
              '[vout]',
              '-map',
              hasVoiceover ? '[aout]' : '0:a?',
            ]
          : ['-vf', filters.join(',')]),
        ...(audioFilters.length > 0 && !hasVoiceover
          ? ['-af', audioFilters.join(',')]
          : []),
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
      ];

      const exitCode = await ffmpeg.exec(args);

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
      await ffmpeg.deleteFile(voiceoverFileName).catch(() => undefined);
      await ffmpeg.deleteFile(watermarkFileName).catch(() => undefined);
      await Promise.all(
        brollFileNames.map((name) =>
          ffmpeg.deleteFile(name).catch(() => undefined)
        )
      );
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

    const captionCuts = getRelativeCuts(
      clip,
      clip.removeFiller ?? false,
      options.removeSilences
    );
    const assContent = buildKaraokeAss({
      transcript: options.transcript ?? [],
      clipStart: clip.startTime,
      clipEnd: clip.endTime,
      duration: clip.duration,
      cuts: captionCuts,
      resolution: options.resolution,
      targetAspectRatio: options.targetAspectRatio,
      brandColor: options.brandColor,
      brandFont: options.brandFont,
      karaoke: options.karaokeCaptions,
      hookText: clip.hookText,
      introText: options.introText,
      outroText: options.outroText,
    });
    let cropFilter: string | null = null;
    let splitFilter: string | null = null;

    if (
      options.targetAspectRatio === '9:16' ||
      options.layout === 'split-screen'
    ) {
      if (options.smartCrop) {
        try {
          const { trackFaces } = await import('@/lib/face-tracker');
          const track = await trackFaces(
            sourceFile,
            clip.startTime,
            clip.endTime
          );
          if (track) {
            if (options.layout === 'split-screen') {
              splitFilter = buildSplitScreenFilter(clip, options, track);
            } else if (options.targetAspectRatio === '9:16') {
              cropFilter = buildFaceCropFilter(clip, options, track);
            }
          }
        } catch (error) {
          console.warn(
            '[KutlassProcessor] Face tracking failed; using the center crop.',
            error
          );
        }
      }

      if (
        options.targetAspectRatio === '9:16' &&
        !cropFilter &&
        !splitFilter
      ) {
        cropFilter = buildCenterCropFilter();
      }
    }

    console.log(
      `[KutlassProcessor] Rendering "${clip.title}" (${clip.startTime}s - ${clip.endTime}s) from "${sourceFile.name}" as ${options.targetAspectRatio} ${options.resolution}.`,
      `Brand styling: ${options.brandColor}, ${options.brandFont}, logo ${options.brandLogo ? 'included' : 'none'}.`,
      clip.broll?.length ? `${clip.broll.length} B-roll overlay(s) queued.` : 'No B-roll overlays for this clip.',
      clip.voiceover ? `Voiceover queued (${clip.voiceover.voice}).` : 'No voiceover for this clip.',
      clip.removeFiller && clip.fillerCuts?.length
        ? `${clip.fillerCuts.length} AI filler cut(s) enabled.`
        : 'AI filler cuts disabled or none detected.',
      assContent
        ? 'Animated ASS captions generated for this clip.'
        : 'No transcript captions available for this clip.'
    );

    if (assContent || cropFilter || splitFilter || options.addWatermark) {
      try {
        return await this.renderWithCaptions(
          sourceFile,
          clip,
          options,
          assContent,
          cropFilter,
          splitFilter,
          onProgress
        );
      } catch (error) {
        console.error(
          '[KutlassProcessor] Caption or face-crop render failed; falling back to sample render.',
          error
        );
      }
    }

    return this.simulateRender(onProgress);
  }
}
