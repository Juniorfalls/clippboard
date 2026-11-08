-- Team workspaces: teams, members and team-scoped projects.

create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  owner_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('invited', 'active')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, email)
);

create index if not exists team_members_user_idx
  on public.team_members (user_id);
create unique index if not exists team_members_team_user_idx
  on public.team_members (team_id, user_id)
  where user_id is not null;

create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  title text not null,
  source_name text,
  clip_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists projects_team_created_idx
  on public.projects (team_id, created_at desc);

-- Security-definer helper avoids recursive team_members RLS checks.
create or replace function public.is_team_member(target_team_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.team_members
    where team_id = target_team_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

-- Link pending email invites to the signed-in user.
create or replace function public.link_team_invites()
returns void
language sql
security definer
set search_path = public
as $$
  update public.team_members as member
  set user_id = auth.uid(),
      status = 'active'
  from auth.users as account
  where member.user_id is null
    and member.status = 'invited'
    and lower(member.email) = lower(account.email)
    and account.id = auth.uid();
$$;

-- Creates a personal team for first-time users, or returns their existing teams.
create or replace function public.ensure_personal_team(team_name text default 'My workspace')
returns setof public.teams
language plpgsql
security definer
set search_path = public
as $$
declare
  new_team_id uuid;
  account_email text;
begin
  if auth.uid() is null then
    return;
  end if;

  perform public.link_team_invites();

  if exists (
    select 1 from public.team_members
    where user_id = auth.uid() and status = 'active'
  ) then
    return query
      select teams.*
      from public.teams
      join public.team_members on team_members.team_id = teams.id
      where team_members.user_id = auth.uid()
        and team_members.status = 'active'
      order by teams.created_at asc;
    return;
  end if;

  select email into account_email from auth.users where id = auth.uid();

  insert into public.teams (name, owner_id)
  values (coalesce(nullif(trim(team_name), ''), 'My workspace'), auth.uid())
  returning id into new_team_id;

  insert into public.team_members (team_id, user_id, email, role, status)
  values (new_team_id, auth.uid(), coalesce(account_email, ''), 'owner', 'active');

  return query select * from public.teams where id = new_team_id;
end;
$$;

grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.link_team_invites() to authenticated;
grant execute on function public.ensure_personal_team(text) to authenticated;

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.projects enable row level security;

drop policy if exists "Members can view their teams" on public.teams;
create policy "Members can view their teams"
  on public.teams for select
  using (public.is_team_member(id));

drop policy if exists "Members can view team members" on public.team_members;
create policy "Members can view team members"
  on public.team_members for select
  using (public.is_team_member(team_id));

drop policy if exists "Members can invite teammates" on public.team_members;
create policy "Members can invite teammates"
  on public.team_members for insert
  with check (public.is_team_member(team_id));

drop policy if exists "Members can view team projects" on public.projects;
create policy "Members can view team projects"
  on public.projects for select
  using (public.is_team_member(team_id));

drop policy if exists "Members can create team projects" on public.projects;
create policy "Members can create team projects"
  on public.projects for insert
  with check (public.is_team_member(team_id) and user_id = auth.uid());
