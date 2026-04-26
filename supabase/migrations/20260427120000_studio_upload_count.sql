-- Studio: count how many times the user loads a new source image (profile + RPC).

alter table public.profiles
  add column if not exists studio_image_upload_count integer not null default 0;

comment on column public.profiles.studio_image_upload_count is
  'Times the user chose a new source image in Studio/Lab (drop, tray, or preload from Datasets).';

comment on column public.profiles.code_export_count is
  'Times the user exported the pipeline: Copy JSON, Copy Python, or Download .py from Export pipeline.';

create or replace function public.increment_studio_image_upload_count()
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.profiles
  set studio_image_upload_count = coalesce(studio_image_upload_count, 0) + 1
  where id = auth.uid();
end;
$$;

grant execute on function public.increment_studio_image_upload_count() to authenticated;
