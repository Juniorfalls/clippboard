-- Profile details and safe self-service updates.

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists company_name text;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, is_admin)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    false
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- Only user-editable profile columns may be updated by clients. This keeps
-- is_admin and plan protected from self-service changes.
revoke update on public.profiles from authenticated;
grant update (full_name, company_name) on public.profiles to authenticated;
