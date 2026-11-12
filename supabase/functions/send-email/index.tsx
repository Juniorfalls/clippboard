import { renderAsync } from "npm:@react-email/components@^1";
import { withSupabase } from "npm:@supabase/server@^1";
import React from "npm:react@^19";
import { Resend } from "npm:resend@^6";
import { Webhook } from "npm:standardwebhooks@^1";
import { MagicLinkEmail } from "./_templates/magic-link.tsx";

type SupabaseSendEmailHookPayload = {
  user?: {
    email?: string;
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

type EdgeFunctionError = Error & {
  code?: number;
};

const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const hookSecret = (Deno.env.get("SEND_EMAIL_HOOK_SECRET") ?? "").replace(
  /^v1,whsec_/,
  ""
);

export default {
  fetch: withSupabase({ auth: "none" }, async (req) => {
    try {
      if (req.method !== "POST") {
        return Response.json({ error: "not allowed" }, { status: 400 });
      }

      if (!resendApiKey || !hookSecret) {
        throw Object.assign(
          new Error(
            "RESEND_API_KEY or SEND_EMAIL_HOOK_SECRET is not configured."
          ),
          { code: 500 }
        );
      }

      const payload = await req.text();
      const headers = Object.fromEntries(req.headers);
      const wh = new Webhook(hookSecret);
      const { user, email_data } = wh.verify(
        payload,
        headers
      ) as SupabaseSendEmailHookPayload;
      const email = user?.email;
      const token = email_data?.token;

      if (!email || !token) {
        throw Object.assign(
          new Error("The auth hook payload is missing an email or token."),
          { code: 400 }
        );
      }

      const resend = new Resend(resendApiKey);
      const html = await renderAsync(MagicLinkEmail({ token }));
      const { error } = await resend.emails.send({
        from: "onboarding@resend.dev",
        to: [email],
        subject: "Your Clippboard login code",
        html,
      });

      if (error) {
        throw Object.assign(new Error(error.message), { code: 502 });
      }

      return Response.json({});
    } catch (error) {
      console.error("Edge Function Error:", error);
      const edgeError = error as EdgeFunctionError;
      return Response.json(
        {
          error: {
            http_code: edgeError.code ?? 500,
            message: edgeError.message ?? String(error),
          },
        },
        { status: 401 }
      );
    }
  }),
};
