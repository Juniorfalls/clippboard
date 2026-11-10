// types/video.ts

export interface TranscriptWord {
  word: string;
  start: number;
  end: number;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  words?: TranscriptWord[];
}

export interface TimeRange {
  start: number;
  end: number;
}

export interface BRollSuggestion {
  query: string;
  startTime: number; // Offset from the clip start
  duration: number;
  url?: string;
}

export interface Voiceover {
  voice: string;
  script: string;
  audioUrl: string;
}

export interface Clip {
  id: string;
  title: string;
  hookText: string; // Short on-screen hook shown for the first 3 seconds
  startTime: number; // in seconds
  endTime: number;   // in seconds
  duration: number;
  engagementScore: number; // AI engagement rating from 1 to 100
  cutRanges?: TimeRange[]; // Removed spoken-word ranges in source time
  fillerCuts?: TimeRange[]; // AI-detected filler words, pauses and bad takes in source time
  silenceCuts?: TimeRange[]; // Gaps longer than 0.5s in source time
  removeFiller?: boolean;
  broll?: BRollSuggestion[];
  voiceover?: Voiceover;
  status: 'pending' | 'processing' | 'completed' | 'error' | 'scheduled';
  scheduledFor?: string;
  publishPlatforms?: string[];
  url?: string;      // The final rendered video blob URL
  storageUrl?: string; // Public Supabase Storage URL used for publishing
}

export interface ProcessingOptions {
  targetAspectRatio: '9:16' | '16:9' | '1:1';
  resolution: '1080p' | '4K';
  layout: 'single' | 'split-screen';
  animationText: string; // The specific text to overlay
  animationStyle: 'single-line';
  brandColor: string;
  brandFont: string;
  brandLogo?: string;
  addWatermark: boolean;
  removeSilences: boolean;
  karaokeCaptions: boolean;
  smartCrop: boolean;
  introText?: string;
  outroText?: string;
  transcript?: TranscriptSegment[];
}

export interface AIAnalysisResult {
  clips: Clip[];
  transcript?: TranscriptSegment[];
}

// The contract for finding moments
export interface IAIAnalyzer {
  analyze(file: File, prompt: string): Promise<AIAnalysisResult>;
}

// The contract for rendering the video
export interface IVideoProcessor {
  processClip(sourceFile: File, clip: Clip, options: ProcessingOptions, onProgress: (progress: number) => void): Promise<string>; 
}
