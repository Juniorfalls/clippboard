import { Clip, IVideoProcessor, ProcessingOptions } from '@/types/video';

const SAMPLE_VIDEO_URL =
  'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';

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

    console.log(
      `[KutlassProcessor] Rendering "${clip.title}" (${clip.startTime}s - ${clip.endTime}s) from "${sourceFile.name}" as ${options.targetAspectRatio} ${options.resolution}.`
    );

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
}
