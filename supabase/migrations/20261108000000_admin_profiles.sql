-- Admin profiles and access control.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists is_admin boolean not null default false,
  add column if not exists created_at timestamptz not null default now();

-- Backfill profiles for existing accounts.
insert into public.profiles (id, email)
select id, email from auth.users
on conflict (id) do nothing;

-- Create a profile whenever a new account signs up.
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, new.email, false)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function public.handle_new_user_profile();

-- Security-definer helper so profile RLS can safely check admin status.
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_admin() to authenticated;
grant select on public.profiles to authenticated;

alter table public.profiles enable row level security;

drop policy if exists "Users can view their own profile or admins view all" on public.profiles;
create policy "Users can view their own profile or admins view all"
  on public.profiles for select
  using (id = auth.uid() or public.is_admin());

-- Admins can read every profile through the same select policy, with no
-- client-side update policy so is_admin cannot be self-granted.
