import { Webhook } from "npm:standardwebhooks";
import { Resend } from "npm:resend";
import { render } from "npm:@react-email/render";
import MagicLinkEmail from "./_templates/magic-link.tsx";

type SendEmailHookPayload = {
  user?: {
    email?: string;
  };
  email_data?: {
    token?: string;
    email_action_type?: string;
  };
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return json({ error: { http_code: 405, message: "Method not allowed." } }, 405);
  }

  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  const hookSecret = Deno.env.get("SEND_EMAIL_HOOK_SECRET");

  if (!resendApiKey || !hookSecret) {
    return json(
      {
        error: {
          http_code: 500,
          message: "Email hook secrets are not configured.",
        },
      },
      500
    );
  }

  try {
    const payload = await request.text();
    const headers = Object.fromEntries(request.headers.entries());
    const webhook = new Webhook(hookSecret);
    const { user, email_data } = webhook.verify(
      payload,
      headers
    ) as SendEmailHookPayload;

    const email = user?.email;
    const token = email_data?.token;

    if (!email || !token) {
      return json(
        {
          error: {
            http_code: 400,
            message: "The auth hook payload is missing an email or token.",
          },
        },
        400
      );
    }

    const resend = new Resend(resendApiKey);
    const html = await render(MagicLinkEmail({ token }));

    const { error } = await resend.emails.send({
      from: "onboarding@resend.dev",
      to: [email],
      subject: "Your Clippboard login code",
      html,
    });

    if (error) {
      throw new Error(error.message);
    }

    return json({});
  } catch (error) {
    return json(
      {
        error: {
          http_code: 500,
          message:
            error instanceof Error
              ? error.message
              : "Could not send the login code.",
        },
      },
      500
    );
  }
});
