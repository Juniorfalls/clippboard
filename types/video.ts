// types/video.ts

export interface Clip {
  id: string;
  title: string;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  duration: number;
  status: 'pending' | 'processing' | 'completed' | 'error';
  url?: string;      // The final rendered video blob URL
}

export interface ProcessingOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1';
  resolution: '1080p' | '4K';
  animationText: string; // The specific text to overlay
  animationStyle: 'single-line'; 
}

export interface AIAnalysisResult {
  clips: Clip[];
}

// The contract for finding moments
export interface IAIAnalyzer {
  analyze(file: File, prompt: string): Promise<AIAnalysisResult>;
}

// The contract for rendering the video
export interface IVideoProcessor {
  processClip(sourceFile: File, clip: Clip, options: ProcessingOptions, onProgress: (progress: number) => void): Promise<string>; 
}
