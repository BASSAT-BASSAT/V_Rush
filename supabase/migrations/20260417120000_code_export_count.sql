-- Count how many times a user exports Python (copy or download); shown on profile.

alter table public.profiles
  add column if not exists code_export_count integer not null default 0;

comment on column public.profiles.code_export_count is
  'Incremented when the user copies or downloads generated Python from the pipeline.';

-- Atomic increment under RLS (caller must be authenticated).
create or replace function public.increment_code_export_count()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.profiles
  set code_export_count = coalesce(code_export_count, 0) + 1
  where id = auth.uid();
end;
$$;

grant execute on function public.increment_code_export_count() to authenticated;
