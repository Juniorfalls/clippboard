-- Add AI-generated thumbnail URLs to saved clips.

alter table public.clips
  add column if not exists thumbnail_url text;

grant update on public.clips to authenticated;
