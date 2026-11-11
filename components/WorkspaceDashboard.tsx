"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRealtime } from "inngest/react";
import { Captions, Clapperboard, FolderOpen, Loader2, Lock, ScanFace, Scissors } from "lucide-react";
import { toast } from "sonner";
import { CustomSelect } from "@/components/CustomSelect";
import { CustomDropzone } from "@/components/CustomDropzone";
import { CustomTextArea } from "@/components/CustomTextArea";
import { useTeam } from "@/components/TeamProvider";
import { ClipSkeleton } from "@/components/ClipSkeleton";
import { ClipGallery } from "@/components/ClipGallery";
import type { PublishPayload } from "@/components/PublishModal";
import { getVideoProcessor } from "@/services/video";
import { extractAudio } from "@/lib/extract-audio";
import { loadBrandKit, type BrandTemplate } from "@/lib/brand-kit";
import {
  videoProcessingChannel,
  type VideoProcessingUpdate,
} from "@/lib/inngest/realtime";
import { STARTER_CLIP_LIMIT, type Plan } from "@/lib/plans";
import { createClient } from "@/utils/supabase/client";
import { cn } from "@/lib/utils";
import type { Clip, ProcessingOptions, TranscriptSegment } from "@/types/video";

const FORMATS = [
  { value: "9:16", label: "TikTok 9:16" },
  { value: "16:9", label: "Landscape 16:9" },
  { value: "1:1", label: "Square 1:1" },
];

const RESOLUTIONS = [
  { value: "1080p", label: "1080p" },
  { value: "4K", label: "4K Upscale" },
];

const PROMPT_PRESETS = [
  {
    id: "high-performing-hook",
    label: "High-Performing Hook",
    prompt:
      "Find the most engaging hook in this video and turn it into a punchy 9:16 TikTok clip with a strong opening line.",
  },
  {
    id: "educational",
    label: "Educational",
    prompt:
      "Find the clearest educational explanations in this video and turn each into a concise 9:16 clip that teaches one useful idea.",
  },
  {
    id: "funny-moment",
    label: "Funny Moment",
    prompt:
      "Find the funniest moments in this video and cut them into shareable 9:16 clips that land the joke quickly.",
  },
  {
    id: "podcast-highlight",
    label: "Podcast Highlight",
    prompt:
      "Find the strongest podcast highlights in this video and turn them into 9:16 clips with a clear, self-contained story.",
  },
];

const focusRing =
  "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue";

const REALTIME_STATUS_MESSAGES: Partial<
  Record<VideoProcessingUpdate["stage"], string>
> = {
  queued: "Extracting audio in your browser...",
  uploading: "Uploading secure audio...",
  transcribing: "AI is transcribing your video...",
  analyzing: "AI is finding the best moments...",
  rendering: "Rendering final clips in your browser...",
};

type TeamProject = {
  id: string;
  title: string;
  source_name: string | null;
  clip_count: number;
  created_at: string;
};

type VideoJobRow = {
  status: "queued" | "processing" | "completed" | "failed";
  error: string | null;
  transcript: TranscriptSegment[] | null;
};

type ClipRow = {
  id: string;
  title: string;
  duration: number | null;
  engagement_score: number | null;
  start_time: number | null;
  end_time: number | null;
  hook_text: string | null;
  virality_reason: string | null;
  metadata: Partial<Clip> | null;
};

export function WorkspaceDashboard({
  userId,
  plan,
  initialClipsThisMonth,
  addWatermark,
  unauthorized = false,
}: {
  userId: string;
  plan: Plan;
  initialClipsThisMonth: number;
  addWatermark: boolean;
  unauthorized?: boolean;
}) {
  const { activeTeamId, activeTeam } = useTeam();
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedAudioUrl, setUploadedAudioUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [prompt, setPrompt] = useState("Find the 10 best moments from this video.");
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [overlayText, setOverlayText] = useState("");
  const [format, setFormat] = useState<ProcessingOptions["targetAspectRatio"]>("9:16");
  const [resolution, setResolution] =
    useState<ProcessingOptions["resolution"]>("1080p");
  const [layout, setLayout] =
    useState<ProcessingOptions["layout"]>("single");
  const [autoRemoveSilences, setAutoRemoveSilences] = useState(true);
  const [karaokeCaptions, setKaraokeCaptions] = useState(true);
  const [smartCrop, setSmartCrop] = useState(true);
  const [templates, setTemplates] = useState<BrandTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("none");
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [analysisStatus, setAnalysisStatus] = useState<string | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [progressById, setProgressById] = useState<Record<string, number>>({});
  const [transcript, setTranscript] = useState<TranscriptSegment[]>([]);
  const [projects, setProjects] = useState<TeamProject[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [clipsThisMonth, setClipsThisMonth] = useState(initialClipsThisMonth);
  const hasShownClipPersistError = useRef(false);
  const uploadAbortRef = useRef<AbortController | null>(null);
  const completedJobRef = useRef<string | null>(null);

  const realtime = useRealtime({
    channel: videoProcessingChannel(activeJobId ?? "idle"),
    topics: ["status"],
    enabled: Boolean(activeJobId),
    token: async () => {
      if (!activeJobId) {
        throw new Error("No active video-processing job.");
      }

      const response = await fetch("/api/inngest/realtime-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: activeJobId }),
      });
      const data = (await response.json().catch(() => null)) as
        | { key?: string; apiBaseUrl?: string; error?: string }
        | null;

      if (!response.ok || !data?.key) {
        throw new Error(data?.error ?? "Could not subscribe to job updates.");
      }

      return { key: data.key, apiBaseUrl: data.apiBaseUrl };
    },
  });

  const starterLimitReached =
    plan === "starter" && clipsThisMonth >= STARTER_CLIP_LIMIT;

  useEffect(() => {
    if (!unauthorized) return;

    toast.error("Unauthorized access", {
      description: "You do not have permission to view the admin dashboard.",
    });
    window.history.replaceState({}, "", "/dashboard");
  }, [unauthorized]);

  useEffect(() => {
    if (!starterLimitReached) return;

    toast.error("Starter limit reached. Please upgrade.", {
      description: `Starter includes ${STARTER_CLIP_LIMIT} generated clips per month.`,
    });
  }, [starterLimitReached]);

  useEffect(() => {
    const saved = loadBrandKit(userId);
    setLayout(saved.layout);
    setTemplates(saved.templates);
    setSelectedTemplateId((current) =>
      saved.templates.some((template) => template.id === current)
        ? current
        : "none"
    );
  }, [userId]);

  useEffect(() => {
    let cancelled = false;

    async function loadProjects() {
      if (!activeTeamId) {
        setProjects([]);
        return;
      }

      setLoadingProjects(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("projects")
          .select("id, title, source_name, clip_count, created_at")
          .eq("team_id", activeTeamId)
          .order("created_at", { ascending: false })
          .limit(6);

        if (error) throw error;
        if (!cancelled) setProjects((data ?? []) as TeamProject[]);
      } catch (error) {
        if (!cancelled) {
          setProjects([]);
          toast.error("Could not load projects", {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
        }
      } finally {
        if (!cancelled) setLoadingProjects(false);
      }
    }

    void loadProjects();
    return () => {
      cancelled = true;
    };
  }, [activeTeamId]);

  useEffect(() => {
    return () => {
      uploadAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!activeJobId) return;

    const lastMessage = realtime.messages.last;
    if (!lastMessage || lastMessage.kind !== "data") return;

    const update = lastMessage.data as VideoProcessingUpdate | null;
    if (!update || update.jobId !== activeJobId) return;

    if (update.stage === "failed") {
      completedJobRef.current = activeJobId;
      setAnalysisStatus(update.message);
      setIsProcessing(false);
      setActiveJobId(null);
      toast.dismiss("analysis-status");
      toast.error("Video processing failed", {
        description: update.message,
      });
      return;
    }

    if (update.stage === "complete") {
      startFinishJob(activeJobId);
      return;
    }

    const displayMessage =
      REALTIME_STATUS_MESSAGES[update.stage] ?? update.message;
    setAnalysisStatus(displayMessage);
    toast.loading(displayMessage, {
      id: "analysis-status",
      description: "Processing in the background.",
    });
  }, [activeJobId, realtime.messages.last]);

  useEffect(() => {
    if (!activeJobId || realtime.connectionStatus !== "open") return;

    const jobId = activeJobId;
    let cancelled = false;

    async function reconcileJobStatus() {
      const supabase = createClient();
      const { data } = await supabase
        .from("video_jobs")
        .select("status, error")
        .eq("id", jobId)
        .maybeSingle();

      if (cancelled || !data) return;

      if (data.status === "completed") {
        startFinishJob(jobId);
        return;
      }

      if (data.status === "failed") {
        completedJobRef.current = jobId;
        setAnalysisStatus("Processing failed. Please try again.");
        setIsProcessing(false);
        setActiveJobId(null);
        toast.dismiss("analysis-status");
        toast.error("Video processing failed", {
          description: data.error ?? "Please try again.",
        });
      }
    }

    void reconcileJobStatus();
    return () => {
      cancelled = true;
    };
  }, [activeJobId, realtime.connectionStatus]);

  async function handleFileChange(file: File | null) {
    uploadAbortRef.current?.abort();
    uploadAbortRef.current = null;
    toast.dismiss("video-upload");
    setUploadedFile(file);
    setUploadedAudioUrl(null);

    if (!file) {
      setIsUploading(false);
      setAnalysisStatus(null);
      return;
    }

    const controller = new AbortController();
    uploadAbortRef.current = controller;
    setIsUploading(true);

    const toastId = "video-upload";
    setAnalysisStatus("Extracting audio in your browser...");
    toast.loading("Extracting audio in your browser...", {
      id: toastId,
      description: "Your original video never leaves this device.",
    });

    try {
      const audioFile = await extractAudio(file, (progress) => {
        const percentage = Math.round(progress * 100);
        setAnalysisStatus("Extracting audio in your browser...");
        toast.loading("Extracting audio in your browser...", {
          id: toastId,
          description: `${percentage}% complete. Your video stays on this device.`,
        });
      });

      if (controller.signal.aborted) return;

      setAnalysisStatus("Uploading secure audio...");
      toast.loading("Uploading secure audio...", {
        id: toastId,
        description: "Only the compressed audio track is uploaded.",
      });

      const safeName =
        file.name
          .replace(/\.[^.]+$/, "")
          .replace(/[^a-zA-Z0-9._-]+/g, "-")
          .slice(-100) || "video";
      const blob = await upload(
        `audio/${userId}/${Date.now()}-${safeName}-audio.mp3`,
        audioFile,
        {
          access: "public",
          handleUploadUrl: "/api/upload",
          multipart: true,
          contentType: "audio/mpeg",
          clientPayload: JSON.stringify({ userId }),
          abortSignal: controller.signal,
          onUploadProgress: ({ percentage }) => {
            toast.loading("Uploading secure audio...", {
              id: toastId,
              description: `${Math.round(percentage)}% uploaded`,
            });
          },
        }
      );

      if (controller.signal.aborted) return;

      setUploadedAudioUrl(blob.url);
      toast.success("Audio ready", {
        id: toastId,
        description:
          "Your original video stays in this browser for clip rendering.",
      });
    } catch (error) {
      if (controller.signal.aborted) return;

      setUploadedFile(null);
      setUploadedAudioUrl(null);
      toast.error("Could not prepare audio", {
        id: toastId,
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      if (uploadAbortRef.current === controller) {
        uploadAbortRef.current = null;
        setIsUploading(false);
        setAnalysisStatus(null);
      }
    }
  }

  function updateClip(id: string, patch: Partial<Clip>) {
    setClips((previous) =>
      previous.map((clip) => (clip.id === id ? { ...clip, ...patch } : clip))
    );
  }

  async function persistClip(clip: Clip) {
    try {
      const supabase = createClient();
      const payload = {
        title: clip.title,
        duration: clip.duration,
        engagement_score: clip.engagementScore,
        start_time: clip.startTime,
        end_time: clip.endTime,
        hook_text: clip.hookText,
        virality_reason: clip.viralityReason,
        video_url: clip.storageUrl ?? null,
        status: clip.status,
        metadata: clip,
        updated_at: new Date().toISOString(),
      };

      const { data: updated, error: updateError } = await supabase
        .from("clips")
        .update(payload)
        .eq("id", clip.id)
        .eq("user_id", userId)
        .select("id");

      if (updateError) throw updateError;

      if (!updated?.length) {
        const { error: insertError } = await supabase.from("clips").insert({
          id: clip.id,
          user_id: userId,
          ...payload,
        });
        if (insertError) throw insertError;
      }
    } catch (error) {
      if (!hasShownClipPersistError.current) {
        hasShownClipPersistError.current = true;
        toast.error("Could not save clip analytics", {
          description:
            error instanceof Error ? error.message : "Please try again.",
        });
      }
    }
  }

  async function uploadRenderedVideo(clip: Clip, renderedUrl: string) {
    try {
      const response = await fetch(renderedUrl);
      if (!response.ok) throw new Error("The rendered clip could not be read.");
      const blob = await response.blob();
      if (!blob.size) throw new Error("The rendered clip is empty.");

      const supabase = createClient();
      const path = `${userId}/${clip.id}-${Date.now()}.mp4`;
      const { error } = await supabase.storage
        .from("rendered_clips")
        .upload(path, blob, {
          contentType: "video/mp4",
          cacheControl: "31536000",
          upsert: true,
        });

      if (error) throw error;

      const { data } = supabase.storage
        .from("rendered_clips")
        .getPublicUrl(path);
      return data.publicUrl;
    } catch (error) {
      toast.error("Clip rendered but could not upload", {
        description:
          error instanceof Error
            ? `${error.message} Publishing will be unavailable for this clip.`
            : "Publishing will be unavailable for this clip.",
      });
      return null;
    }
  }

  function startFinishJob(jobId: string) {
    if (completedJobRef.current === jobId) return;
    completedJobRef.current = jobId;
    void finishRealtimeJob(jobId);
  }

  async function handleGenerate() {
    if (starterLimitReached) {
      toast.error("Starter limit reached. Please upgrade.", {
        description: `Upgrade to Pro for unlimited clips.`,
      });
      return;
    }

    if (!uploadedFile) {
      toast.error("Add a video first", {
        description: "Drop a raw video above to generate clips.",
      });
      return;
    }

    if (!uploadedAudioUrl) {
      toast.error(
        isUploading ? "Audio is still being prepared" : "Add a video first",
        {
          description:
            "Wait for browser audio extraction and the secure upload to finish.",
        }
      );
      return;
    }

    setIsProcessing(true);
    setActiveJobId(null);
    completedJobRef.current = null;
    setClips([]);
    setProgressById({});
    setAnalysisStatus("Uploading secure audio...");

    const statusToastId = "analysis-status";
    toast.loading("Uploading secure audio...", {
      id: statusToastId,
      description: "Sending the compressed audio to the AI worker.",
    });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioBlobUrl: uploadedAudioUrl,
          prompt,
          userId,
          sourceName: uploadedFile.name,
          options: {
            targetAspectRatio: format,
            resolution,
            layout,
            animationText: overlayText,
            addWatermark,
            removeSilences: autoRemoveSilences,
            karaokeCaptions,
            smartCrop,
          },
        }),
      });

      const queued = (await response.json().catch(() => null)) as
        | { jobId?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          queued?.error ??
            `Could not queue video processing (${response.status}).`
        );
      }

      if (!queued?.jobId) {
        throw new Error("The analysis service did not return a job ID.");
      }

      setActiveJobId(queued.jobId);
      setAnalysisStatus("AI is transcribing your video...");
      toast.loading("AI is transcribing your video...", {
        id: statusToastId,
        description: "Waiting for the first live update.",
      });
    } catch (error) {
      toast.dismiss(statusToastId);
      toast.error("Could not queue video processing", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
      setIsProcessing(false);
      setAnalysisStatus(null);
      setActiveJobId(null);
    }
  }

  async function finishRealtimeJob(jobId: string) {
    const statusToastId = "analysis-status";
    const sourceFile = uploadedFile;

    try {
      if (!sourceFile) {
        throw new Error("The source video is no longer available.");
      }

      setAnalysisStatus("Rendering final clips in your browser...");
      toast.loading("Rendering final clips in your browser...", {
        id: statusToastId,
        description: "Loading the completed analysis.",
      });

      const supabase = createClient();
      const { data: jobData, error: jobError } = await supabase
        .from("video_jobs")
        .select("status, error, transcript")
        .eq("id", jobId)
        .maybeSingle();

      if (jobError) throw jobError;

      const job = jobData as VideoJobRow | null;
      if (job?.status === "failed") {
        throw new Error(job.error ?? "Video processing failed.");
      }

      if (job?.status !== "completed") {
        throw new Error("Video processing has not completed yet.");
      }

      const { data: clipRows, error: clipsError } = await supabase
        .from("clips")
        .select(
          "id, title, duration, engagement_score, start_time, end_time, hook_text, virality_reason, metadata"
        )
        .eq("job_id", jobId)
        .order("engagement_score", { ascending: false });

      if (clipsError) throw clipsError;

      const analysis = {
        clips: ((clipRows ?? []) as ClipRow[]).map((row) => {
          const metadata = row.metadata ?? {};
          return {
            ...metadata,
            id: row.id,
            title: row.title,
            duration: Number(row.duration ?? metadata.duration ?? 0),
            engagementScore: Number(
              row.engagement_score ?? metadata.engagementScore ?? 0
            ),
            startTime: Number(row.start_time ?? metadata.startTime ?? 0),
            endTime: Number(row.end_time ?? metadata.endTime ?? 0),
            hookText: row.hook_text ?? metadata.hookText ?? "",
            viralityReason:
              row.virality_reason ?? metadata.viralityReason ?? "",
            status: "pending" as const,
          };
        }),
        transcript: Array.isArray(job.transcript) ? job.transcript : [],
      };

      if (analysis.clips.length === 0) {
        throw new Error("No memorable moments were found in this video.");
      }

      setAnalysisStatus("Rendering final clips in your browser...");
      setClips(analysis.clips);
      setTranscript(analysis.transcript);
      toast.loading("Rendering final clips in your browser...", {
        id: statusToastId,
        description: `${analysis.clips.length} clips ready. Rendering in your browser.`,
      });

      if (activeTeamId) {
        try {
          const projectTitle = sourceFile.name.replace(/\.[^.]+$/, "");
          const { data: project, error: projectError } = await supabase
            .from("projects")
            .insert({
              team_id: activeTeamId,
              user_id: userId,
              title: projectTitle,
              source_name: sourceFile.name,
              clip_count: analysis.clips.length,
            })
            .select("id, title, source_name, clip_count, created_at")
            .single();

          if (!projectError && project) {
            setProjects((previous) => [
              project as TeamProject,
              ...previous,
            ].slice(0, 6));
          }
        } catch (error) {
          toast.error("Could not save this project", {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
        }
      }

      const processor = getVideoProcessor();
      const brandKit = loadBrandKit(userId);
      const selectedTemplate = brandKit.templates.find(
        (template) => template.id === selectedTemplateId
      );
      const options: ProcessingOptions = {
        targetAspectRatio: format,
        resolution,
        layout,
        animationText: overlayText,
        animationStyle: "single-line",
        brandColor: selectedTemplate?.color ?? brandKit.color,
        brandFont: selectedTemplate?.font ?? brandKit.font,
        brandLogo: brandKit.logo ?? undefined,
        addWatermark,
        removeSilences: autoRemoveSilences,
        karaokeCaptions,
        smartCrop,
        introText: selectedTemplate?.introText || undefined,
        outroText: selectedTemplate?.outroText || undefined,
        transcript: analysis.transcript ?? [],
      };

      let failedCount = 0;

      for (const clip of analysis.clips) {
        updateClip(clip.id, { status: "processing" });
        setProgressById((previous) => ({ ...previous, [clip.id]: 0 }));

        try {
          const url = await processor.processClip(
            sourceFile,
            clip,
            options,
            (progress) => {
              const rounded = Math.round(progress);
              setProgressById((previous) => ({
                ...previous,
                [clip.id]: rounded,
              }));
            }
          );

          setProgressById((previous) => ({ ...previous, [clip.id]: 100 }));
          const storageUrl = await uploadRenderedVideo(clip, url);
          const completedClip: Clip = {
            ...clip,
            status: "completed",
            url,
            storageUrl: storageUrl ?? undefined,
          };
          updateClip(clip.id, {
            status: "completed",
            url,
            storageUrl: storageUrl ?? undefined,
          });
          setClipsThisMonth((count) => count + 1);
          void persistClip(completedClip);
        } catch (error) {
          failedCount += 1;
          updateClip(clip.id, { status: "error" });
          toast.error(`Could not render ${clip.title}`, {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
        }
      }

      if (failedCount === 0) {
        toast.success(`All ${analysis.clips.length} clips generated successfully!`);
      } else {
        toast.error("Some clips could not be generated", {
          description: `${failedCount} of ${analysis.clips.length} clips failed.`,
        });
      }
    } catch (error) {
      toast.error("Could not load generated clips", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsProcessing(false);
      setAnalysisStatus(null);
      setActiveJobId(null);
      toast.dismiss(statusToastId);
    }
  }

  function handleScheduleClip(clip: Clip, payload: PublishPayload) {
    updateClip(clip.id, {
      status: "scheduled",
      scheduledFor: payload.scheduledFor,
      publishPlatforms: payload.platforms,
    });
  }

  async function handleTrimClip(updatedClip: Clip) {
    if (!uploadedFile) {
      toast.error("Video unavailable", {
        description: "Re-upload the source video before trimming this clip.",
      });
      return;
    }

    updateClip(updatedClip.id, {
      startTime: updatedClip.startTime,
      endTime: updatedClip.endTime,
      duration: updatedClip.duration,
      status: "processing",
    });
    setProgressById((previous) => ({ ...previous, [updatedClip.id]: 0 }));

    try {
      const processor = getVideoProcessor();
      const brandKit = loadBrandKit(userId);
      const selectedTemplate = brandKit.templates.find(
        (template) => template.id === selectedTemplateId
      );
      const options: ProcessingOptions = {
        targetAspectRatio: format,
        resolution,
        layout,
        animationText: overlayText,
        animationStyle: "single-line",
        brandColor: selectedTemplate?.color ?? brandKit.color,
        brandFont: selectedTemplate?.font ?? brandKit.font,
        brandLogo: brandKit.logo ?? undefined,
        addWatermark,
        removeSilences: autoRemoveSilences,
        karaokeCaptions,
        smartCrop,
        introText: selectedTemplate?.introText || undefined,
        outroText: selectedTemplate?.outroText || undefined,
        transcript,
      };

      const url = await processor.processClip(
        uploadedFile,
        updatedClip,
        options,
        (progress) => {
          setProgressById((previous) => ({
            ...previous,
            [updatedClip.id]: Math.round(progress),
          }));
        }
      );

      setProgressById((previous) => ({ ...previous, [updatedClip.id]: 100 }));
      const storageUrl = await uploadRenderedVideo(updatedClip, url);
      updateClip(updatedClip.id, {
        status: "completed",
        url,
        storageUrl: storageUrl ?? undefined,
      });
      setClipsThisMonth((count) => count + 1);
      void persistClip({
        ...updatedClip,
        duration: updatedClip.endTime - updatedClip.startTime,
        storageUrl: storageUrl ?? undefined,
      });
      toast.success("Trim saved", { description: updatedClip.title });
    } catch (error) {
      updateClip(updatedClip.id, { status: "error" });
      toast.error("Could not re-render clip", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    }
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-[40px] font-bold leading-[1] -tracking-1 md:text-[48px]">
            Workspace
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-brand-blue-light bg-brand-blue-light/50 px-3 py-1.5 text-[12px] font-semibold text-soft-black/70">
              <Clapperboard className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
              Clips Generated This Month:{" "}
              <span className="font-bold text-soft-black">
                {plan === "starter"
                  ? `${clipsThisMonth} / ${STARTER_CLIP_LIMIT}`
                  : "Unlimited"}
              </span>
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-border-gray bg-white px-3 py-1.5 text-[12px] font-semibold text-soft-black/70",
                isProcessing && "border-brand-blue-light text-soft-black"
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "h-2 w-2 rounded-full bg-brand-blue",
                  isProcessing && "animate-pulse"
                )}
              />
              Browser-based processing · Keep tab open
            </span>
          </div>
        </div>
        <p className="max-w-xl text-[16px] text-soft-black/70 md:text-[18px]">
          Upload a raw video and Clippboard finds the 10 best moments, reframes
          them for TikTok and upscales to 4K.
        </p>
      </header>

      <section aria-label="Team projects" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[24px] font-bold leading-[1.25]">
              Team projects
            </h2>
            <p className="text-[14px] text-soft-black/60">
              Recent projects in {activeTeam?.name ?? "your workspace"}.
            </p>
          </div>
          {loadingProjects && (
            <span className="text-[12px] font-semibold text-soft-black/50">
              Loading...
            </span>
          )}
        </div>

        {projects.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <article
                key={project.id}
                className="flex items-start gap-3 rounded-2xl border border-border-gray bg-white p-4"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-blue-light text-brand-blue">
                  <FolderOpen className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate text-[16px] font-semibold text-soft-black">
                    {project.title}
                  </h3>
                  <p className="mt-0.5 truncate text-[12px] text-soft-black/50">
                    {project.clip_count} clips ·{" "}
                    {new Date(project.created_at).toLocaleDateString()}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          !loadingProjects && (
            <div className="rounded-2xl border border-dashed border-border-gray bg-white px-5 py-6 text-[14px] text-soft-black/60">
              No projects in this workspace yet. Generate clips and the project
              will appear here for your team.
            </div>
          )
        )}
      </section>

      <section aria-label="Create clips" className="flex flex-col gap-6">
        <CustomDropzone
          file={uploadedFile}
          onFileChange={handleFileChange}
          disabled={isProcessing || isUploading}
        />

        <div className="grid gap-5 rounded-2xl border border-border-gray bg-white p-5 md:grid-cols-2 md:p-6">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2" role="group" aria-label="Prompt presets">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  aria-pressed={activePreset === preset.id}
                  disabled={isProcessing}
                  onClick={() => {
                    setPrompt(preset.prompt);
                    setActivePreset(preset.id);
                  }}
                  className={cn(
                    "inline-flex items-center justify-center rounded-full border px-4 py-2 text-[14px] font-semibold transition-colors duration-200",
                    "outline-none focus-visible:ring-2 focus-visible:ring-brand-blue",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    activePreset === preset.id
                      ? "border-brand-blue bg-brand-blue-light text-soft-black"
                      : "border-border-gray bg-white text-soft-black hover:bg-warm-white"
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <CustomTextArea
              label="What should Clippboard find?"
              value={prompt}
              onChange={(value) => {
                setPrompt(value);
                setActivePreset(null);
              }}
              placeholder="Find the best 10 moments. Add the text 'Subscribe for more'..."
              hint="Describe the moments and style you want the AI to look for."
              maxLength={240}
              rows={4}
              disabled={isProcessing}
            />
          </div>
          <CustomTextArea
            label="On-screen text"
            value={overlayText}
            onChange={setOverlayText}
            placeholder="Subscribe for more!"
            hint="Shown once on each clip as a single-line animation. Leave empty for none."
            maxLength={80}
            rows={4}
            disabled={isProcessing}
          />
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <CustomSelect
            label="Target format"
            value={format}
            onValueChange={(value) =>
              setFormat(value as ProcessingOptions["targetAspectRatio"])
            }
            options={FORMATS}
          />
          <CustomSelect
            label="Resolution"
            value={resolution}
            onValueChange={(value) => {
              if (value === "4K" && plan === "starter") {
                toast.error("4K export is a Pro feature", {
                  description: "Upgrade to Pro to render in 4K.",
                });
                return;
              }
              setResolution(value as ProcessingOptions["resolution"]);
            }}
            options={RESOLUTIONS}
          />
          <div className="flex min-w-[255px] flex-1 items-center justify-between gap-3 rounded-2 border border-border-gray bg-white p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <ScanFace className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
              <div>
                <p className="text-[14px] font-semibold text-soft-black">
                  Smart Crop (Face Tracking)
                </p>
                <p className="text-[12px] text-soft-black/50">
                  Keep the speaker centered in 9:16.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={smartCrop}
              aria-label="Smart crop face tracking"
              onClick={() => setSmartCrop((current) => !current)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full border duration-200",
                smartCrop
                  ? "border-brand-blue bg-brand-blue"
                  : "border-border-gray bg-soft-black/15",
                focusRing
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm duration-200",
                  smartCrop ? "left-[22px]" : "left-[3px]"
                )}
              />
            </button>
          </div>
          <div className="flex min-w-[255px] flex-1 items-center justify-between gap-3 rounded-2 border border-border-gray bg-white p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <Captions className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
              <div>
                <p className="text-[14px] font-semibold text-soft-black">
                  Karaoke Captions
                </p>
                <p className="text-[12px] text-soft-black/50">
                  Highlight each word as it is spoken.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={karaokeCaptions}
              aria-label="Karaoke captions"
              onClick={() => setKaraokeCaptions((current) => !current)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full border duration-200",
                karaokeCaptions
                  ? "border-brand-blue bg-brand-blue"
                  : "border-border-gray bg-soft-black/15",
                focusRing
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm duration-200",
                  karaokeCaptions ? "left-[22px]" : "left-[3px]"
                )}
              />
            </button>
          </div>
          <div className="flex min-w-[255px] flex-1 items-center justify-between gap-3 rounded-2 border border-border-gray bg-white p-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <Scissors className="mt-0.5 h-4 w-4 shrink-0 text-brand-blue" aria-hidden />
              <div>
                <p className="text-[14px] font-semibold text-soft-black">
                  Auto-Remove Silences
                </p>
                <p className="text-[12px] text-soft-black/50">
                  Skip pauses longer than 0.5 seconds.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoRemoveSilences}
              aria-label="Auto-remove silences"
              onClick={() => setAutoRemoveSilences((current) => !current)}
              className={cn(
                "relative h-7 w-12 shrink-0 rounded-full border duration-200",
                autoRemoveSilences
                  ? "border-brand-blue bg-brand-blue"
                  : "border-border-gray bg-soft-black/15",
                focusRing
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-sm duration-200",
                  autoRemoveSilences ? "left-[22px]" : "left-[3px]"
                )}
              />
            </button>
          </div>
          {templates.length > 0 && (
            <CustomSelect
              label="Brand template"
              value={selectedTemplateId}
              onValueChange={setSelectedTemplateId}
              options={[
                { value: "none", label: "No template" },
                ...templates.map((template) => ({
                  value: template.id,
                  label: template.name,
                })),
              ]}
            />
          )}
          <div className="flex flex-col gap-2 md:ml-auto md:items-end">
            {starterLimitReached && (
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-soft-black/60">
                <Lock className="h-3.5 w-3.5 text-brand-blue" aria-hidden />
                Starter limit reached.{" "}
                <Link
                  href="/#pricing"
                  className={cn("text-brand-blue underline-offset-2 hover:underline", focusRing)}
                >
                  Upgrade to Pro
                </Link>
              </p>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isProcessing || isUploading || starterLimitReached}
              aria-busy={isProcessing || isUploading}
              className={cn(
                "inline-flex items-center justify-center rounded-xl bg-brand-blue px-8 py-3 text-[16px] font-semibold text-soft-black duration-200",
                "hover:bg-brand-blue-hover",
                focusRing,
                "disabled:cursor-not-allowed disabled:bg-brand-blue-light disabled:text-soft-black/60"
              )}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Generating clips
                </>
              ) : starterLimitReached ? (
                "Starter limit reached"
              ) : (
                "Generate 10 Clips"
              )}
            </button>
          </div>
        </div>
      </section>

      <section
        aria-label="Clips"
        aria-live="polite"
        aria-busy={isProcessing}
        className="flex flex-col gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[24px] font-bold leading-[1.25]">Your clips</h2>
          {(isProcessing || isUploading) && (
            <p className="text-[14px] font-semibold text-soft-black/60">
              {analysisStatus ??
                "Browser rendering in progress. Please keep tab open."}
            </p>
          )}
        </div>

        {isProcessing && clips.length === 0 ? (
          <div className="grid grid-cols-1 gap-4 xs:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <ClipSkeleton key={i} className="mx-auto w-full max-w-sm xs:max-w-none" />
            ))}
          </div>
        ) : clips.length > 0 ? (
          <ClipGallery
            clips={clips}
            progressById={progressById}
            onTrim={handleTrimClip}
            onSchedule={handleScheduleClip}
            transcript={transcript}
            plan={plan}
            userId={userId}
          />
        ) : (
          <div className="relative flex flex-col items-center overflow-hidden rounded-3 border border-dashed border-border-gray bg-white px-6 py-16 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-brand-blue-light/70 to-transparent"
            />
            <span className="relative mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-brand-blue-light bg-white text-brand-blue">
              <Clapperboard className="h-8 w-8" aria-hidden />
            </span>
            <h3 className="relative text-[20px] font-bold leading-[1.25]">
              {uploadedFile ? "Ready when you are" : "No clips yet"}
            </h3>
            <p className="relative mt-2 max-w-sm text-[16px] text-soft-black/60">
              {uploadedFile
                ? "Your video is ready. Hit Generate 10 Clips and we will find the moments worth sharing."
                : "Upload a video and hit Generate. We will find your 10 best moments and turn them into shareable clips."}
            </p>
            <p className="relative mt-5 text-[12px] font-semibold text-soft-black/40">
              Browser-based processing · Keep tab open during export
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
