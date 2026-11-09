export type SocialPlatformId = "tiktok" | "youtube" | "instagram";

export type SocialPlatform = {
  id: SocialPlatformId;
  label: string;
  description: string;
};

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  {
    id: "tiktok",
    label: "TikTok",
    description: "Post short-form clips directly to TikTok.",
  },
  {
    id: "youtube",
    label: "YouTube Shorts",
    description: "Publish vertical clips to your YouTube channel.",
  },
  {
    id: "instagram",
    label: "Instagram Reels",
    description: "Share Reels with your Instagram audience.",
  },
];

const VALID_IDS = new Set<SocialPlatformId>(
  SOCIAL_PLATFORMS.map((platform) => platform.id)
);

function storageKey(userId: string) {
  return `clippboard:socials:${userId}`;
}

export function loadConnectedAccounts(userId: string): SocialPlatformId[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (id): id is SocialPlatformId =>
        typeof id === "string" && VALID_IDS.has(id as SocialPlatformId)
    );
  } catch {
    return [];
  }
}

export function saveConnectedAccounts(
  userId: string,
  accounts: SocialPlatformId[]
) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(storageKey(userId), JSON.stringify(accounts));
}
