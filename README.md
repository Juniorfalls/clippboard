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
```

`PEXELS_API_KEY` enables stock B-roll suggestions. Without it, B-roll lookups are skipped.

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

   Also update the **Site URL** to your production domain. Without this step, magic-link sign-in will fail or redirect to the wrong host.

6. Run `supabase db push` against the production Supabase project if migrations have not already been applied.

## Authentication

Clippboard uses Supabase magic links. After a user requests a sign-in link, Supabase redirects through:

```text
/auth/callback?code=...
```

The callback exchanges the code for a session and sends the user to `/dashboard`. The callback route is relative to the current origin, so no application URL needs to be hardcoded.

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
