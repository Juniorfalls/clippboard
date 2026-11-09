import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/utils/supabase/server";
import { encryptToken } from "@/lib/token-crypto";

export const dynamic = "force-dynamic";

type TikTokTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  open_id?: string;
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
  response.cookies.delete("tiktok_oauth_state");
  return response;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");
  const savedState = cookies().get("tiktok_oauth_state")?.value;

  if (oauthError) {
    return failure(request, "TikTok authorization was cancelled.");
  }

  if (!code || !state || !savedState || state !== savedState) {
    return failure(request, "TikTok authorization could not be verified.");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    return failure(request, "TikTok OAuth is not configured.");
  }

  try {
    const origin =
      process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
    const tokenResponse = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/tiktok/callback`,
      }),
      cache: "no-store",
    });

    const tokenData = (await tokenResponse.json().catch(() => null)) as
      | TikTokTokenResponse
      | null;

    if (!tokenResponse.ok || !tokenData?.access_token) {
      throw new Error(
        tokenData?.error_description ||
          tokenData?.error ||
          "TikTok did not return an access token."
      );
    }

    const { error } = await supabase.from("connected_accounts").upsert(
      {
        user_id: user.id,
        platform: "tiktok",
        access_token: encryptToken(tokenData.access_token),
        refresh_token: tokenData.refresh_token
          ? encryptToken(tokenData.refresh_token)
          : null,
        expires_at: tokenData.expires_in
          ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
          : null,
        platform_user_id: tokenData.open_id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,platform" }
    );

    if (error) throw error;

    const response = NextResponse.redirect(
      new URL("/dashboard/settings?social_connected=tiktok", request.url)
    );
    response.cookies.delete("tiktok_oauth_state");
    return response;
  } catch (error) {
    return failure(
      request,
      error instanceof Error ? error.message : "TikTok connection failed."
    );
  }
}
