-- Run this in the Supabase SQL Editor after enabling pg_cron and pg_net under
-- Database > Extensions. Replace the two placeholder values before running.
--
-- The service role key is stored in Supabase Vault and sent only in the
-- server-to-server apikey header. Never commit the real key to this file.

create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if exists (
    select 1 from vault.secrets where name = 'clippboard_project_url'
  ) then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'clippboard_project_url'),
      'https://clippboard-lilac.vercel.app'
    );
  else
    perform vault.create_secret(
      'https://clippboard-lilac.vercel.app',
      'clippboard_project_url',
      'Clippboard production URL used by the publishing cron'
    );
  end if;

  if exists (
    select 1 from vault.secrets where name = 'clippboard_service_role_key'
  ) then
    perform vault.update_secret(
      (select id from vault.secrets where name = 'clippboard_service_role_key'),
      '<YOUR_SUPABASE_SERVICE_ROLE_KEY>'
    );
  else
    perform vault.create_secret(
      '<YOUR_SUPABASE_SERVICE_ROLE_KEY>',
      'clippboard_service_role_key',
      'Service role key used by the scheduled publishing cron'
    );
  end if;
end $$;

-- Replace any previous version of this job before scheduling it again.
do $$
declare
  existing_job_id bigint;
begin
  for existing_job_id in
    select jobid from cron.job where jobname = 'publish-scheduled-clips'
  loop
    perform cron.unschedule(existing_job_id);
  end loop;
end $$;

select cron.schedule(
  'publish-scheduled-clips',
  '* * * * *',
  $job$
  select net.http_post(
    url := (
      select decrypted_secret
      from vault.decrypted_secrets
      where name = 'clippboard_project_url'
    ) || '/api/cron/publish',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'clippboard_service_role_key'
      ),
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'clippboard_service_role_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
  $job$
);
