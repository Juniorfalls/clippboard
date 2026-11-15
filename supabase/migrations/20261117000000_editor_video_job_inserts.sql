-- Allow creators to create and update their own standalone editor projects.

grant insert, update on public.video_jobs to authenticated;

alter table public.video_jobs enable row level security;

drop policy if exists "Users can insert their own video jobs" on public.video_jobs;
create policy "Users can insert their own video jobs"
  on public.video_jobs for insert
  with check (user_id = auth.uid());

drop policy if exists "Users can update their own video jobs" on public.video_jobs;
create policy "Users can update their own video jobs"
  on public.video_jobs for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
