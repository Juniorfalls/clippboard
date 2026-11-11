-- Ensure authenticated users can update their own generated clips.

grant update on public.clips to authenticated;

alter table public.clips enable row level security;

drop policy if exists "Users can update their own clips" on public.clips;
create policy "Users can update their own clips"
  on public.clips for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
