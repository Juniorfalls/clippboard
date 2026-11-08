-- Persist generated clip metadata and expose real admin metrics.

create table if not exists public.clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled clip',
  duration double precision not null default 0,
  virality_score integer not null default 0,
  created_at timestamptz not null default now(),
  video_url text
);

create index if not exists clips_user_id_created_at_idx
  on public.clips (user_id, created_at desc);
create index if not exists clips_created_at_idx
  on public.clips (created_at desc);

grant select, insert on public.clips to authenticated;

alter table public.clips enable row level security;

drop policy if exists "Users can view their own clips or admins view all" on public.clips;
create policy "Users can view their own clips or admins view all"
  on public.clips for select
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Users can insert their own clips" on public.clips;
create policy "Users can insert their own clips"
  on public.clips for insert
  with check (user_id = auth.uid());

-- Real counts for the admin dashboard. Reads auth.users with security-definer
-- privileges, but only returns rows when the caller is an admin.
create or replace function public.admin_metrics()
returns table (
  total_users bigint,
  total_clips bigint,
  clips_this_week bigint
)
language sql
security definer
stable
set search_path = public
as $$
  select
    (select count(*) from auth.users),
    (select count(*) from public.clips),
    (select count(*) from public.clips where created_at >= now() - interval '7 days')
  where public.is_admin();
$$;

grant execute on function public.admin_metrics() to authenticated;
