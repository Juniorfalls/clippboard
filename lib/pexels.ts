type PexelsVideoFile = {
  file_type?: string;
  width?: number;
  height?: number;
  link?: string;
};

type PexelsVideo = {
  video_files?: PexelsVideoFile[];
};

type PexelsResponse = {
  videos?: PexelsVideo[];
};

const cache = new Map<string, string | null>();

export async function findPexelsBroll(query: string): Promise<string | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const normalized = query.trim().toLowerCase();
  if (!normalized) return null;
  if (cache.has(normalized)) return cache.get(normalized) ?? null;

  try {
    const response = await fetch(
      `https://api.pexels.com/videos/search?query=${encodeURIComponent(
        normalized
      )}&per_page=5&orientation=portrait`,
      {
        headers: { Authorization: apiKey },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      cache.set(normalized, null);
      return null;
    }

    const data = (await response.json()) as PexelsResponse;
    const files = (data.videos ?? [])
      .flatMap((video) => video.video_files ?? [])
      .filter(
        (file): file is PexelsVideoFile & { link: string } =>
          file.file_type === "video/mp4" &&
          typeof file.link === "string" &&
          file.link.startsWith("https://")
      );

    const best = files.sort((a, b) => {
      const aRatio = (a.width ?? 9) / (a.height ?? 16);
      const bRatio = (b.width ?? 9) / (b.height ?? 16);
      return Math.abs(aRatio - 9 / 16) - Math.abs(bRatio - 9 / 16);
    })[0];

    const url = best?.link ?? null;
    cache.set(normalized, url);
    return url;
  } catch {
    cache.set(normalized, null);
    return null;
  }
}
