export type SocialPlatformId = "tiktok" | "youtube" | "instagram";

export type SocialPlatform = {
  id: SocialPlatformId;
  label: string;
  description: string;
  oauth: boolean;
};

export type ConnectedAccount = {
  id: string;
  platform: SocialPlatformId;
  platform_user_id: string | null;
  expires_at: string | null;
  created_at?: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "tiktok",
    label: "TikTok",
    description: "Post short-form clips directly to TikTok.",
    oauth: true,
  },
  {
    id: "youtube",
    label: "YouTube Shorts",
    description: "Publish vertical clips to your YouTube channel.",
    oauth: true,
  },
  {
    id: "instagram",
    label: "Instagram Reels",
    description: "Share Reels with your Instagram audience.",
    oauth: false,
  },
];
