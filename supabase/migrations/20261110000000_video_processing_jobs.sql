-- Background video processing jobs and richer clip metadata.

create table if not exists public.video_jobs (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'queued'
    check (status in ('queued', 'processing', 'completed', 'failed')),
  error text,
  prompt text,
  source_name text,
  options jsonb not null default '{}'::jsonb,
  transcript jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists video_jobs_user_id_created_at_idx
  on public.video_jobs (user_id, created_at desc);

grant select on public.video_jobs to authenticated;

alter table public.video_jobs enable row level security;

drop policy if exists "Users can view their own video jobs or admins view all"
  on public.video_jobs;
create policy "Users can view their own video jobs or admins view all"
  on public.video_jobs for select
  using (user_id = auth.uid() or public.is_admin());

alter table public.clips
  add column if not exists job_id text,
  add column if not exists start_time double precision not null default 0,
  add column if not exists end_time double precision not null default 0,
  add column if not exists hook_text text,
  add column if not exists virality_reason text,
  add column if not exists status text not null default 'completed',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists clips_job_id_idx
  on public.clips (job_id);

grant update on public.clips to authenticated;

drop policy if exists "Users can update their own clips" on public.clips;
create policy "Users can update their own clips"
  on public.clips for update
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
