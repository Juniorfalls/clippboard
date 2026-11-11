# Clippboard

**An AI-powered SaaS that turns long-form videos into engaging, vertical short-form clips. It uses a privacy-first, browser-based rendering engine (WebCodecs/WASM) to ensure raw footage never leaves the user's machine.**

Clippboard combines AI moment detection, transcription, automatic reframing, animated captions, and client-side video rendering in one focused workspace for creators and teams.

---

## Core Features

- **AI moment detection and hook generation** with OpenAI GPT-4o
- **Whisper transcription** with word-level timestamps
- **9:16 auto-reframing** with face tracking and podcast split-screen layouts
- **Karaoke captions** with word-timed highlighting
- **Browser-based rendering** through Kutlass and FFmpeg WASM
- **Privacy-first architecture** with no raw video uploads to application servers
- **6-digit OTP authentication** using Supabase Auth and a Resend Edge Function
- **Filler-word and silence removal** for tighter pacing
- **Brand kits and templates** for consistent colors, fonts, intros, and outros
- **AI B-roll and voiceover** support
- **Direct publishing and scheduling** for TikTok and YouTube
- **Team workspaces, projects, and admin analytics**
- **Final Cut Pro XML export** for professional editing workflows
- **Paystack subscriptions** with Starter, Pro, and Agency plans

---

## Tech Stack

| Area | Technology |
| --- | --- |
| Framework | Next.js (App Router), TypeScript |
| Styling | Tailwind CSS and the Clippboard design system |
| UI components | Radix UI headless primitives, custom selects, modals, and uploaders |
| Database and auth | Supabase Auth, Postgres, Row Level Security, Edge Functions |
| Transactional email | Resend with React Email |
| AI | OpenAI Whisper and GPT-4o |
| Video processing | Kutlass / FFmpeg WASM in the browser |
| Payments | Paystack Checkout and signed webhooks |
| Notifications | Sonner |

---

## Privacy-First Architecture

Video rendering runs entirely in the browser:

1. The browser extracts a small audio file for transcription.
2. Groq Whisper generates word-level timestamps, then Gemini, OpenRouter, and Groq identify clip moments with automatic fallback.
3. Kutlass and FFmpeg WASM render the final video locally on the user's machine.

Raw source video is not uploaded to Clippboard servers for rendering. Optional social publishing uploads only the finished rendered clip to a public Supabase Storage bucket so TikTok and YouTube can fetch it.

---

## Requirements

- Node.js 18 or newer
- A Supabase project
- An OpenAI API key
- A Resend account for production OTP email delivery

---

## Local Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   GROQ_API_KEY=your_groq_api_key
   GEMINI_API_KEY=your_gemini_api_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   DEEPGRAM_API_KEY=your_deepgram_api_key
   ```

3. Apply the database migrations:

   ```bash
   supabase db push
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

### Required for local development

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous client key |
| `GROQ_API_KEY` | Groq Whisper transcription and LLM fallback |
| `GEMINI_API_KEY` | Primary free AI clip analysis |
| `OPENROUTER_API_KEY` | Secondary AI clip-analysis fallback |
| `DEEPGRAM_API_KEY` | Deepgram transcription health checks |
| `BLOB_READ_WRITE_TOKEN` | Direct browser-to-Vercel-Blob uploads |
| `INNGEST_EVENT_KEY` | Queue background video-processing jobs |

**Resend credentials are not stored in `.env.local`.** The `RESEND_API_KEY` and `SEND_EMAIL_HOOK_SECRET` values belong in Supabase Edge Function secrets.

### Additional production variables

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_your_store_token
INNGEST_EVENT_KEY=your_inngest_event_key
INNGEST_SIGNING_KEY=signkey_your_inngest_signing_key
PAYSTACK_SECRET_KEY=sk_live_or_test_key
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=pk_live_or_test_key
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
DEEPGRAM_API_KEY=your_deepgram_api_key

TOKEN_ENCRYPTION_KEY=your_32_byte_base64_key
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
TIKTOK_PRIVACY_LEVEL=SELF_ONLY
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
YOUTUBE_PRIVACY_STATUS=private
CRON_SECRET=your_cron_secret
PEXELS_API_KEY=your_pexels_api_key

# Optional: voiceover and MCP tools only
OPENAI_API_KEY=your_openai_api_key
OPENAI_TTS_MODEL=gpt-4o-mini-tts
OPENAI_BASE_URL=your_openai_compatible_base_url
```

`SUPABASE_SERVICE_ROLE_KEY` is required for Paystack webhooks, scheduled publishing, and server-side administrative operations. `BLOB_READ_WRITE_TOKEN` lets the browser upload source videos directly to Vercel Blob, bypassing serverless request-size limits. `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` connect the app to Inngest Cloud so transcription and AI analysis run outside the request timeout. Clip analysis falls back from Gemini to OpenRouter to Groq when a free tier is exhausted; OpenAI is only needed for optional voiceover and MCP tools. `TOKEN_ENCRYPTION_KEY` encrypts social OAuth tokens at rest and must remain stable after accounts are connected.

Generate an encryption key with:

```bash
openssl rand -base64 32
```

---

## Supabase Edge Function Setup

The OTP login flow uses the `send-email` Edge Function to verify Supabase Auth hook requests and send branded codes through Resend.

1. Deploy the function:

   ```bash
   npx --yes supabase@latest login
   npx --yes supabase@latest link --project-ref <project-ref>
   npx --yes supabase@latest secrets set RESEND_API_KEY=re_your_key
   npx --yes supabase@latest secrets set SEND_EMAIL_HOOK_SECRET="v1,whsec_your_secret"
   npx --yes supabase@latest functions deploy send-email --no-verify-jwt
   ```

2. In Supabase, open **Authentication → Auth Hooks → Send Email** and set the hook URL to:

   ```text
   https://<project-ref>.supabase.co/functions/v1/send-email
   ```

3. Copy the generated hook signing secret into the `SEND_EMAIL_HOOK_SECRET` Edge Function secret.

4. Ensure the Supabase **Magic Link** email template includes `{{ .Token }}` so the 6-digit OTP is visible.

The function uses `standardwebhooks` for signature verification, `@react-email/render` for the email template, and Resend for delivery.

---

## Authentication

Clippboard uses passwordless email OTP authentication:

1. The user enters their email.
2. Supabase generates a 6-digit code and triggers the Send Email hook.
3. The Edge Function sends the code through Resend.
4. The login form verifies the code with `verifyOtp` and starts the session.

Profiles are created automatically through a Supabase Auth trigger.

---

## Paystack Billing

Checkout is handled through the authenticated `/api/checkout` route. The server initializes a Paystack transaction in USD for the selected plan and returns the authorization URL to the frontend.

Subscription upgrades are applied by `/api/webhook` after Paystack sends a `charge.success` event. Webhooks are verified using the `x-paystack-signature` header and an HMAC SHA512 digest of the raw request body.

Register the production webhook URL in the Paystack dashboard:

```text
https://your-domain.com/api/webhook
```

Subscribe it to `charge.success`, then add `PAYSTACK_SECRET_KEY` and `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY` to Vercel.

---

## Social Publishing

Clippboard connects TikTok and YouTube accounts with OAuth 2.0 and stores tokens encrypted with AES-256-GCM.

1. Add the TikTok redirect URI: `https://your-domain.com/api/auth/tiktok/callback`.
2. Add the YouTube redirect URI: `https://your-domain.com/api/auth/youtube/callback`.
3. Enable the YouTube Data API v3 in Google Cloud.
4. Keep TikTok apps in sandbox mode with `TIKTOK_PRIVACY_LEVEL=SELF_ONLY` until review is complete.
5. Enable `pg_cron` and `pg_net` in Supabase, then run `supabase/sql/schedule_publish_cron.sql` in the SQL Editor. Replace the service-role placeholder first.

Scheduled publishing runs inside Supabase and authenticates to `/api/cron/publish` with Vault-stored credentials.

---

## Database Migrations

Migrations live in `supabase/migrations/` and cover:

- Profiles, admin roles, and subscription plans
- Team workspaces and projects
- Clip tracking and analytics
- Connected social accounts, encrypted OAuth tokens, and scheduled posts
- The public `rendered_clips` Storage bucket and access policies

Apply them with:

```bash
supabase db push
```

---

## Deployment on Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add the required environment variables to the Vercel project settings.
4. Deploy the project.
5. In Supabase, open **Authentication → URL Configuration** and set the **Site URL** to your production domain.
6. Add the production redirect URL:

   ```text
   https://your-domain.com/auth/callback
   ```

7. Add the production OAuth callback URLs in the TikTok and Google developer consoles.
8. Deploy the `send-email` Edge Function and configure the Supabase Send Email hook.
9. Create the Paystack webhook endpoint and add both Paystack keys.
10. Create an Inngest Cloud app pointing at `https://your-domain.com/api/inngest`, then add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` to Vercel.
11. Run `supabase db push` against the production project if migrations are not already applied.
12. Enable `pg_cron` and `pg_net` and run the publishing cron SQL after deployment.

---

## Available Scripts

```bash
npm run dev     # Start the development server
npm run build   # Create a production build
npm run start   # Run the production build
```

---

## Project Structure

```text
app/                  Next.js pages, API routes, and legal pages
components/           Dashboard, gallery, modals, navigation, and UI primitives
lib/                  Plans, brand kits, Paystack helpers, social publishing, utilities
lib/inngest/          Inngest client and background video-processing function
services/ai/          OpenAI and mock analysis providers
services/video/       Kutlass / FFmpeg WASM rendering pipeline
supabase/migrations/  Database schema, RLS policies, and admin functions
supabase/functions/   Resend OTP email Edge Function
types/                Shared TypeScript types
```

---

## Security Notes

- Raw source video is rendered locally and is not uploaded for processing.
- Extracted audio is sent to OpenAI for transcription and moment detection.
- Supabase Row Level Security restricts access to user, team, project, and clip data.
- Admin metrics use security-definer database functions that verify admin access.
- Paystack webhooks are verified with the `x-paystack-signature` header.
- Social OAuth tokens are encrypted at rest and hidden from browser-readable grants.
- Plan limits are enforced on the server and in the dashboard UI.

---

## License

Private project. All rights reserved.
