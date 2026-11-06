// services/video/index.ts
import { KutlassProcessor } from './KutlassProcessor';
// import { ServerFFmpegProcessor } from './ServerFFmpegProcessor';
import { IVideoProcessor } from '@/types/video';

export const getVideoProcessor = (): IVideoProcessor => {
  if (process.env.NEXT_PUBLIC_VIDEO_ENGINE === 'server') {
    // return new ServerFFmpegProcessor();
  }
  return new KutlassProcessor(); 
};
