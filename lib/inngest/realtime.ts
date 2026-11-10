import { channel, staticSchema } from "inngest/realtime";

export type VideoProcessingUpdate = {
  stage:
    | "queued"
    | "uploading"
    | "transcribing"
    | "analyzing"
    | "rendering"
    | "complete"
    | "failed";
  message: string;
  jobId: string;
  chunk?: number;
  totalChunks?: number;
  progress?: number;
};

export const videoProcessingChannel = channel({
  name: (jobId: string) => `video-process:${jobId}`,
  topics: {
    status: {
      schema: staticSchema<VideoProcessingUpdate>(),
    },
  },
});
