import { decryptToken, encryptToken } from "@/lib/token-crypto";

export type StoredSocialAccount = {
  id: string;
  platform: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  platform_user_id: string | null;
};

type TokenPair = {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
};

async function refreshTikTokToken(account: StoredSocialAccount): Promise<TokenPair> {
  if (!account.refresh_token) {
    throw new Error("TikTok access expired and no refresh token is available.");
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error("TikTok OAuth is not configured.");
  }

  const response = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptToken(account.refresh_token),
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        error_description?: string;
      }
    | null;

  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.error_description || "TikTok could not refresh the access token."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? decryptToken(account.refresh_token),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

async function refreshYouTubeToken(account: StoredSocialAccount): Promise<TokenPair> {
  if (!account.refresh_token) {
    throw new Error("YouTube access expired and no refresh token is available.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("YouTube OAuth is not configured.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: decryptToken(account.refresh_token),
    }),
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as
    | {
        access_token?: string;
        expires_in?: number;
        error_description?: string;
      }
    | null;

  if (!response.ok || !data?.access_token) {
    throw new Error(
      data?.error_description || "Google could not refresh the access token."
    );
  }

  return {
    accessToken: data.access_token,
    refreshToken: decryptToken(account.refresh_token),
    expiresAt: data.expires_in
      ? new Date(Date.now() + data.expires_in * 1000).toISOString()
      : null,
  };
}

export async function getValidSocialToken(account: StoredSocialAccount) {
  const expiresAt = account.expires_at
    ? new Date(account.expires_at).getTime()
    : 0;
  const isFresh = expiresAt > Date.now() + 60_000;

  if (isFresh) {
    return {
      accessToken: decryptToken(account.access_token),
      refreshed: null as TokenPair | null,
    };
  }

  if (!account.refresh_token) {
    return {
      accessToken: decryptToken(account.access_token),
      refreshed: null as TokenPair | null,
    };
  }

  const refreshed =
    account.platform === "tiktok"
      ? await refreshTikTokToken(account)
      : await refreshYouTubeToken(account);

  return { accessToken: refreshed.accessToken, refreshed };
}

export async function publishTikTok(
  accessToken: string,
  videoUrl: string,
  title: string
) {
  const response = await fetch(
    "https://open.tiktokapis.com/v2/post/publish/video/init/",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        post_info: {
          title: title.slice(0, 2200),
          privacy_level: process.env.TIKTOK_PRIVACY_LEVEL ?? "SELF_ONLY",
          disable_comment: false,
          disable_duet: false,
          disable_stitch: false,
        },
        source_info: {
          source: "PULL_FROM_URL",
          video_url: videoUrl,
        },
      }),
      cache: "no-store",
    }
  );

  const data = (await response.json().catch(() => null)) as
    | { data?: { publish_id?: string }; error?: { message?: string; code?: string } }
    | null;

  if (!response.ok || !data?.data?.publish_id) {
    throw new Error(
      data?.error?.message || "TikTok rejected the video publish request."
    );
  }
}

export async function publishYouTube(
  accessToken: string,
  videoUrl: string,
  title: string
) {
  const videoResponse = await fetch(videoUrl);
  if (!videoResponse.ok) {
    throw new Error("Could not download the rendered clip for YouTube.");
  }
  const video = await videoResponse.arrayBuffer();

  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": "video/mp4",
        "X-Upload-Content-Length": String(video.byteLength),
      },
      body: JSON.stringify({
        snippet: {
          title: title.slice(0, 100),
          description: "Published with Clippboard.",
          categoryId: "22",
        },
        status: {
          privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS ?? "private",
          selfDeclaredMadeForKids: false,
        },
      }),
      cache: "no-store",
    }
  );

  const uploadUrl = initResponse.headers.get("location");
  if (!initResponse.ok || !uploadUrl) {
    const error = await initResponse.text().catch(() => "");
    throw new Error(
      error || "YouTube did not start the video upload session."
    );
  }

  const bytes = new Uint8Array(video);
  const chunkSize = 8 * 1024 * 1024;

  for (let start = 0; start < bytes.byteLength; start += chunkSize) {
    const end = Math.min(start + chunkSize, bytes.byteLength) - 1;
    const chunk = bytes.slice(start, end + 1);

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "video/mp4",
        "Content-Length": String(chunk.byteLength),
        "Content-Range": `bytes ${start}-${end}/${bytes.byteLength}`,
      },
      body: chunk,
      cache: "no-store",
    });

    if (!uploadResponse.ok && uploadResponse.status !== 308) {
      const error = await uploadResponse.text().catch(() => "");
      throw new Error(error || "YouTube rejected the video upload.");
    }
  }
}

export async function persistRefreshedTokens(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  accountId: string,
  tokens: TokenPair
) {
  await admin
    .from("connected_accounts")
    .update({
      access_token: encryptToken(tokens.accessToken),
      refresh_token: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expires_at: tokens.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}
