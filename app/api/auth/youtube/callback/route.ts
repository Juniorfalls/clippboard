import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { encryptToken } from "@/lib/token-crypto";

export const dynamic = "force-dynamic";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

function failure(request: Request, message: string) {
  const response = NextResponse.redirect(
    new URL(
      `/dashboard/settings?social_error=${encodeURIComponent(message)}`,
      request.url
    )
  );
  response.cookies.delete("youtube_oauth_state");
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const savedState = cookies().get("youtube_oauth_state")?.value;

  if (oauthError) {
    return failure(request, "YouTube authorization was cancelled.");
  }

  if (!code || !state || !savedState || state !== savedState) {
    return failure(request, "YouTube authorization could not be verified.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return failure(request, "YouTube OAuth is not configured.");
  }

  try {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/youtube/callback`,
      }),
      cache: "no-store",
    });

    const tokenData = (await tokenResponse.json().catch(() => null)) as
      | GoogleTokenResponse
      | null;

    if (!tokenResponse.ok || !tokenData?.access_token) {
      throw new Error(
        tokenData?.error_description ||
          tokenData?.error ||
          "Google did not return an access token."
      );
    }

    const channelResponse = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?part=id&mine=true",
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
        cache: "no-store",
      }
    );
    const channelData = (await channelResponse.json().catch(() => null)) as
      | { items?: { id?: string }[] }
      | null;
    const channelId = channelData?.items?.[0]?.id ?? null;

    const { error } = await supabase.from("connected_accounts").upsert(
      {
        user_id: user.id,
        platform: "youtube",
        access_token: encryptToken(tokenData.access_token),
        refresh_token: tokenData.refresh_token
          ? encryptToken(tokenData.refresh_token)
          : null,
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        platform_user_id: channelId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );

    if (error) throw error;

    const response = NextResponse.redirect(
      new URL("/dashboard/settings?social_connected=youtube", request.url)
    );
    response.cookies.delete("youtube_oauth_state");
    return response;
  } catch (error) {
    return failure(
      request,
      error instanceof Error ? error.message : "YouTube connection failed."
    );
  }
}
