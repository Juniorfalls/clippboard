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
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  if (!resendApiKey || !hookSecret) {
    return errorResponse(500, "Email hook secrets are not configured.");
  }

  const payload = await request.text();
  const headers = Object.fromEntries(request.headers.entries());

  let hookData: SupabaseSendEmailHookPayload;

  try {
    const webhook = new Webhook(hookSecret);
    hookData = webhook.verify(
      payload,
      headers
    ) as SupabaseSendEmailHookPayload;
  } catch (error) {
    return errorResponse(
      401,
      error instanceof Error
        ? `Invalid webhook signature: ${error.message}`
        : "Invalid webhook signature."
    );
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
