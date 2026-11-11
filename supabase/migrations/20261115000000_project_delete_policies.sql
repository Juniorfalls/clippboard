-- Allow users to delete their own projects and the clips that belong to them.

begin;

grant delete on public.clips to authenticated;
grant delete on public.video_jobs to authenticated;

alter table public.clips enable row level security;
alter table public.video_jobs enable row level security;

drop policy if exists "Users can delete their own clips" on public.clips;
create policy "Users can delete their own clips"
  on public.clips for delete
  using (user_id = auth.uid());

drop policy if exists "Users can delete their own video jobs" on public.video_jobs;
create policy "Users can delete their own video jobs"
  on public.video_jobs for delete
  using (user_id = auth.uid());

commit;
