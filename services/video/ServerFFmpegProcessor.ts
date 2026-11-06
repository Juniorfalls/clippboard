import { Clip, IVideoProcessor, ProcessingOptions } from '@/types/video';

export class ServerFFmpegProcessor implements IVideoProcessor {
  async processClip(
    sourceFile: File,
    clip: Clip,
    options: ProcessingOptions,
    onProgress: (progress: number) => void
  ): Promise<string> {
    console.log(
      `[ServerFFmpegProcessor] Placeholder processing clip "${clip.title}" from "${sourceFile.name}"`,
      options
    );

    return Promise.resolve('dummy-video-url');
  }
}
