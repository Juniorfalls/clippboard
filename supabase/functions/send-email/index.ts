import { Webhook } from "npm:standardwebhooks";
import { Resend } from "npm:resend";
import { render } from "npm:@react-email/render";
import MagicLinkEmail from "./_templates/magic-link.tsx";

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

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const errorResponse = (httpCode: number, message: string) =>
  json({ error: { http_code: httpCode, message } }, httpCode);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return errorResponse(405, "Method not allowed.");
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const rawHookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  if (!resendApiKey || !rawHookSecret) {
    return errorResponse(500, "Email hook secrets are not configured.");
  }

  const hookSecret = rawHookSecret
    .replace(/^v1,/, "")
    .replace(/^whsec_/, "");
  const payload = await request.text();
  const webhookHeaders = {
    "webhook-id": request.headers.get("webhook-id") ?? "",
    "webhook-timestamp": request.headers.get("webhook-timestamp") ?? "",
    "webhook-signature": request.headers.get("webhook-signature") ?? "",
  };

  if (
    !webhookHeaders["webhook-id"] ||
    !webhookHeaders["webhook-timestamp"] ||
    !webhookHeaders["webhook-signature"]
  ) {
    console.error(
      "[send-email] Missing webhook-id, webhook-timestamp, or webhook-signature."
    );
    return errorResponse(401, "Missing webhook signature headers.");
  }

  let hookData: SupabaseSendEmailHookPayload;

  try {
    const webhook = new Webhook(hookSecret);
    hookData = webhook.verify(
      payload,
      webhookHeaders
    ) as SupabaseSendEmailHookPayload;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);
    console.error("[send-email] Webhook verification failed:", message);
    return errorResponse(401, `Invalid webhook signature: ${message}`);
  }

  const email = hookData.user?.email;
  const token = hookData.email_data?.token;

  if (!email || !token) {
    return errorResponse(
      400,
      "The auth hook payload is missing an email or token."
    );
  }

  try {
    const resend = new Resend(resendApiKey);
    const html = await render(MagicLinkEmail({ token }));

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [email],
      subject: "Your Clippboard login code",
      html,
    });

    if (error) {
      return errorResponse(502, error.message);
    }

    return json({});
  } catch (error) {
    return errorResponse(
      500,
      error instanceof Error ? error.message : "Could not send the login code."
    );
  }
});
