-- Allow jobs to pause while free AI providers are rate limited.

alter table public.video_jobs
  drop constraint if exists video_jobs_status_check;

alter table public.video_jobs
  add constraint video_jobs_status_check
  check (
    status in (
      'queued',
      'processing',
      'waiting_for_ai',
      'completed',
      'failed'
    )
  );
