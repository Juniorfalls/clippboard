import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";

const MAX_UPLOAD_SIZE = 2 * 1024 * 1024 * 1024;

export async function POST(request: Request) {
  let body: HandleUploadBody;

  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log("[blob] Upload authorization requested", {
          pathname,
          blobTokenPresent: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
          vercelOidcTokenPresent: Boolean(process.env.VERCEL_OIDC_TOKEN),
        });

        if (!process.env.BLOB_READ_WRITE_TOKEN) {
          console.warn(
            "[blob] BLOB_READ_WRITE_TOKEN is missing on the server. Client uploads will fail."
          );
        }

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          throw new Error("Sign in to upload videos.");
        }

        if (clientPayload) {
          try {
            const payload = JSON.parse(clientPayload) as { userId?: unknown };
            if (payload.userId !== user.id) {
              throw new Error("Upload does not belong to this account.");
            }
          } catch (error) {
            if (error instanceof Error && error.message.includes("does not belong")) {
              throw error;
            }
            throw new Error("Invalid upload metadata.");
          }
        }

        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "image/jpeg",
            "image/png",
            "image/webp",
            "audio/mpeg",
            "audio/mp4",
            "audio/wav",
            "audio/x-wav",
            "audio/webm",
          ],
          maximumSizeInBytes: MAX_UPLOAD_SIZE,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ userId: user.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log("[blob] upload completed", {
          url: blob.url,
          contentType: blob.contentType,
          tokenPayload,
        });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Could not authorize upload.",
      },
      { status: 400 }
    );
  }
}
