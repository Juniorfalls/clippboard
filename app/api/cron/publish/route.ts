import { NextResponse } from "next/server";
import { createAdminClient } from "@/utils/supabase/admin";
import {
  getValidSocialToken,
  persistRefreshedTokens,
  publishTikTok,
  publishYouTube,
  type StoredSocialAccount,
} from "@/lib/social-publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type PostRow = {
  id: string;
  title: string;
  video_url: string;
  connected_accounts:
    | StoredSocialAccount
    | StoredSocialAccount[]
    | null;
};

function accountFrom(
  value: PostRow["connected_accounts"]
): StoredSocialAccount | null {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (
    cronSecret &&
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("scheduled_posts")
    .select(
      "id, title, video_url, connected_accounts(id, platform, access_token, refresh_token, expires_at, platform_user_id)"
    )
    .eq("status", "pending")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(5);

  if (error) {
    return NextResponse.json(
      { error: "Could not load pending posts." },
      { status: 500 }
    );
  }

  const posts = (data ?? []) as unknown as PostRow[];
  let published = 0;
  let failed = 0;

  for (const post of posts) {
    const account = accountFrom(post.connected_accounts);

    if (!account) {
      await admin
        .from("scheduled_posts")
        .update({
          status: "failed",
          error: "The connected account is no longer available.",
        })
        .eq("id", post.id);
      failed += 1;
      continue;
    }

    try {
      const { accessToken, refreshed } = await getValidSocialToken(account);

      if (refreshed) {
        await persistRefreshedTokens(admin, account.id, refreshed);
      }

      if (account.platform === "tiktok") {
        await publishTikTok(accessToken, post.video_url, post.title);
      } else if (account.platform === "youtube") {
        await publishYouTube(accessToken, post.video_url, post.title);
      } else {
        throw new Error(`Publishing to ${account.platform} is not supported.`);
      }

      await admin
        .from("scheduled_posts")
        .update({ status: "published", error: null })
        .eq("id", post.id);
      published += 1;
    } catch (publishError) {
      await admin
        .from("scheduled_posts")
        .update({
          status: "failed",
          error:
            publishError instanceof Error
              ? publishError.message.slice(0, 2000)
              : "Publishing failed.",
        })
        .eq("id", post.id);
      failed += 1;
    }
  }

  return NextResponse.json({ processed: posts.length, published, failed });
}
