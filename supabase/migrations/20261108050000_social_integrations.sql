-- Real social integrations, scheduling, encrypted tokens, and clip storage.

create table if not exists public.connected_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('tiktok', 'youtube', 'instagram')),
  access_token text not null,
  refresh_token text,
  expires_at timestamptz,
  platform_user_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);

create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  connected_account_id uuid not null references public.connected_accounts(id) on delete cascade,
  video_url text not null,
  title text not null default 'Untitled clip',
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index if not exists scheduled_posts_pending_idx
  on public.scheduled_posts (status, scheduled_for);

alter table public.connected_accounts enable row level security;
alter table public.scheduled_posts enable row level security;

drop policy if exists "Users can view their own connected accounts" on public.connected_accounts;
create policy "Users can view their own connected accounts"
  on public.connected_accounts for select
  using (user_id = auth.uid());

drop policy if exists "Users can insert their own connected accounts" on public.connected_accounts;
create policy "Users can insert their own connected accounts"
  on public.connected_accounts for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own connected accounts" on public.connected_accounts;
create policy "Users can update their own connected accounts"
  on public.connected_accounts for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can delete their own connected accounts" on public.connected_accounts;
create policy "Users can delete their own connected accounts"
  on public.connected_accounts for delete
  using (user_id = auth.uid());

drop policy if exists "Users can view their own scheduled posts" on public.scheduled_posts;
create policy "Users can view their own scheduled posts"
  on public.scheduled_posts for select
  using (user_id = auth.uid());

drop policy if exists "Users can schedule their own posts" on public.scheduled_posts;
create policy "Users can schedule their own posts"
  on public.scheduled_posts for insert
  with check (user_id = auth.uid());

-- OAuth tokens must never be readable from the browser. Column-level grants
-- expose only non-secret account metadata; server routes handle the tokens.
revoke all on public.connected_accounts from anon, authenticated;
grant select (id, user_id, platform, expires_at, platform_user_id, created_at, updated_at)
  on public.connected_accounts to authenticated;
grant insert, update, delete on public.connected_accounts to authenticated;

revoke all on public.scheduled_posts from anon, authenticated;
grant select, insert on public.scheduled_posts to authenticated;

alter table public.clips
  add column if not exists video_url text;

-- Public rendered clips are referenced by TikTok PULL_FROM_URL and YouTube.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('rendered_clips', 'rendered_clips', true, 536870912, array['video/mp4'])
on conflict (id) do update set
  public = true,
  file_size_limit = 536870912,
  allowed_mime_types = array['video/mp4'];

drop policy if exists "Users can upload rendered clips" on storage.objects;
create policy "Users can upload rendered clips"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'rendered_clips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update rendered clips" on storage.objects;
create policy "Users can update rendered clips"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'rendered_clips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete rendered clips" on storage.objects;
create policy "Users can delete rendered clips"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'rendered_clips'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
