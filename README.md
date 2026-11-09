# Clippboard

Clippboard is an AI-powered SaaS that turns long-form videos into engaging, vertical short-form clips. It uses browser-based processing (WebCodecs/WASM) to render videos securely on the client side, so source footage stays on the creator's machine.

## Core Features

- **AI moment detection** with OpenAI GPT-4o
- **Whisper transcription** with word-level timestamps
- **9:16 auto-reframing** with face tracking and podcast split-screen layouts
- **Browser-based rendering** via Kutlass and FFmpeg WASM
- **Animated captions** with karaoke-style word highlighting
- **Trim and text-based editing**, filler-word removal, B-roll, and voiceover
- **Supabase Auth and database** for accounts, teams, projects, and clip analytics
- **Subscription gating** for Starter, Pro, and Agency plans
- **Admin dashboard** with real user, clip, and plan metrics
- **Final Cut Pro XML export** for Agency workspaces

## Tech Stack

- **Framework:** Next.js (App Router), TypeScript
- **Styling:** Tailwind CSS with the Clippboard design tokens
- **UI primitives:** Radix UI headless components, custom selects, modals, and uploaders
- **Auth and data:** Supabase (Auth, Postgres, Row Level Security)
- **AI:** OpenAI Whisper and GPT-4o
- **Video processing:** Kutlass / FFmpeg WASM in the browser
- **Notifications:** Sonner

## Requirements

- Node.js 18 or newer
- A Supabase project
- An OpenAI API key

## Local Setup

1. Clone the repository and install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```

3. Apply the database migrations to your Supabase project:

   ```bash
   supabase db push
   ```

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

### Optional Environment Variables

```bash
OPENAI_BASE_URL=your_openai_compatible_base_url
OPENAI_MODEL=gpt-4o
OPENAI_TTS_MODEL=gpt-4o-mini-tts
PEXELS_API_KEY=your_pexels_api_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
TOKEN_ENCRYPTION_KEY=your_32_byte_base64_key
TIKTOK_CLIENT_KEY=your_tiktok_client_key
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
CRON_SECRET=your_cron_secret
NEXT_PUBLIC_SITE_URL=https://your-domain.com
```

`PEXELS_API_KEY` enables stock B-roll suggestions. Without it, B-roll lookups are skipped.

`SUPABASE_SERVICE_ROLE_KEY` is required for the scheduled publishing cron. `TOKEN_ENCRYPTION_KEY` encrypts OAuth tokens at rest and must stay stable after accounts are connected. Generate one with:

```bash
openssl rand -base64 32
```

## Social Publishing Setup

Clippboard connects accounts with OAuth 2.0 and stores tokens encrypted with AES-256-GCM. Rendered clips are uploaded to the public `rendered_clips` Supabase Storage bucket so TikTok and YouTube can fetch stable video URLs.

1. Create a TikTok developer app and add `https://your-domain.com/api/auth/tiktok/callback` as a redirect URI. Request `video.upload` and `video.publish` scopes.
2. Create a Google Cloud OAuth client and enable the YouTube Data API v3. Add `https://your-domain.com/api/auth/youtube/callback` as an authorized redirect URI.
3. Set `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `CRON_SECRET`.
4. Keep TikTok apps in sandbox mode with `TIKTOK_PRIVACY_LEVEL=SELF_ONLY` until the app passes TikTok review. YouTube uploads default to private via `YOUTUBE_PRIVACY_STATUS`.
5. Scheduled publishing runs in Supabase, not Vercel. Enable `pg_cron` and `pg_net` under **Database → Extensions**, then run `supabase/sql/schedule_publish_cron.sql` in the Supabase SQL Editor. Replace the service-role placeholder first; the script stores the project URL and key in Vault and schedules `/api/cron/publish` every minute.

## Available Scripts

```bash
npm run dev     # Start the development server
npm run build   # Create a production build
npm run start   # Run the production build
```

## Deployment on Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add the environment variables from `.env.local` to the Vercel project settings.
4. Deploy the project.
5. **Critical:** Add your production auth callback URL to Supabase under **Authentication → URL Configuration → Redirect URLs**:

   ```text
   https://your-domain.com/auth/callback
   ```

   Also update the **Site URL** to your production domain.

6. Run `supabase db push` against the production Supabase project if migrations have not already been applied.
7. Add `TOKEN_ENCRYPTION_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and all OAuth credentials to the Vercel project settings. Confirm the `rendered_clips` bucket and storage policies were created by the latest migration.
8. Add the production OAuth callback URLs in the TikTok and Google developer consoles.
9. Enable `pg_cron` and `pg_net` in Supabase and run `supabase/sql/schedule_publish_cron.sql` after deployment. This replaces Vercel Cron, which is not used by this project.

## Authentication

Clippboard uses Supabase email OTP codes. After a user enters their email, Supabase sends a 6-digit code and the login form verifies it with `verifyOtp`, then redirects to `/dashboard`.

Make sure the Supabase **Magic Link** email template includes `{{ .Token }}` so the 6-digit code is visible in the email. The `/auth/callback` route remains available for OAuth and legacy flows.

## Subscription Plans

Plan gating is stored on `profiles.plan` and enforced in the dashboard:

- **Starter:** limited monthly clip generation, 1080p export
- **Pro:** unlimited clips, 4K export
- **Agency:** everything in Pro plus Final Cut Pro XML export

The `/api/checkout` route currently returns a mock checkout session. Replace it with a real Stripe Checkout session using your Stripe price IDs when billing keys are configured.

## Admin Access

Admin access is controlled by `profiles.is_admin`.

To grant access:

1. Sign in once so your profile row exists.
2. Open the Supabase Table Editor and select the `profiles` table.
3. Set `is_admin` to `true` for your account.
4. Visit `/admin`.

The admin page verifies the session and admin status on the server. Unauthorized users are redirected to `/dashboard` and shown an “Unauthorized access” notification. The Admin link in the sidebar only appears for admins.

## Database Migrations

Migrations live in `supabase/migrations/` and cover:

- Team workspaces and projects
- Profiles and admin roles
- Clip metadata tracking
- Subscription plans
- Connected social accounts, encrypted OAuth tokens, scheduled posts
- The public `rendered_clips` storage bucket and policies

Apply them with the Supabase CLI:

```bash
supabase db push
```

## Security Notes

- Video rendering happens in the browser; source footage is not uploaded for rendering.
- Audio is sent to the analysis API for Whisper transcription and GPT-4o moment detection.
- Supabase Row Level Security restricts users to their own profiles, clips, projects, and team data.
- Admin metrics are exposed through security-definer database functions that verify admin access.
- Plan limits are enforced server-side when the dashboard loads and again in the UI.
- OAuth tokens are encrypted with AES-256-GCM and are never exposed through browser-readable database grants.
- Scheduled publishing runs through the Supabase `pg_cron` job, which authenticates to `/api/cron/publish` with a Vault-stored service-role key. `CRON_SECRET` can protect manual triggers.

## Project Structure

```text
app/                  Next.js routes, API endpoints, legal pages, admin
components/           Dashboard, gallery, modals, navigation, and UI primitives
lib/                  Brand kit, plans, FCPXML export, Pexels, utilities
services/ai/          OpenAI and mock analysis providers
services/video/       Kutlass / FFmpeg WASM rendering pipeline
supabase/migrations/  Database schema, RLS policies, and admin functions
types/                Shared TypeScript types
```

## License

Private project. All rights reserved.
