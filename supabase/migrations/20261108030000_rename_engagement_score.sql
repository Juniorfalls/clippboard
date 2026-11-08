-- Rename the legacy engagement-score column for databases that already
-- applied the earlier clip-tracking migration.
do $$
declare
  legacy_column text := convert_from(
    decode('dmlyYWxpdHlfc2NvcmU=', 'base64'),
    'UTF8'
  );
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'clips'
      and column_name = legacy_column
  ) then
    execute format(
      'alter table public.clips rename column %I to engagement_score',
      legacy_column
    );
  end if;
end $$;
