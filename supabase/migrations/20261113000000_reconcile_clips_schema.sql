-- Reconcile the live clips table with the columns used by the Inngest
-- video-processing worker. Safe to run more than once.

begin;

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled clip',
  duration double precision not null default 0,
  engagement_score integer not null default 0,
  created_at timestamptz not null default now(),
  video_url text
);

do $$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clips'
      and column_name = 'engagement_score'
  ) then
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'clips'
        and column_name = 'virality_score'
    ) then
      alter table public.clips
        rename column virality_score to engagement_score;
    else
      alter table public.clips
        add column engagement_score integer not null default 0;
    end if;
  end if;
end $$;

alter table public.clips
  add column if not exists job_id text,
  add column if not exists start_time double precision not null default 0,
  add column if not exists end_time double precision not null default 0,
  add column if not exists hook_text text,
  add column if not exists virality_reason text,
  add column if not exists status text not null default 'completed',
  add column if not exists metadata jsonb not null default '{}'::jsonb,
  add column if not exists video_url text,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create index if not exists clips_job_id_idx
  on public.clips (job_id);

create index if not exists clips_user_id_created_at_idx
  on public.clips (user_id, created_at desc);

create index if not exists clips_created_at_idx
  on public.clips (created_at desc);

grant select, insert, update on public.clips to authenticated;

commit;
