-- V-Rush: per-user Kaggle credentials stored on the existing profiles row.
-- The Datasets page reads/writes these via PostgREST; backend never reads them.
-- Existing profiles RLS already restricts SELECT/UPDATE to ``auth.uid() = id``,
-- so adding columns here inherits the same row-level isolation.

alter table public.profiles
  add column if not exists kaggle_username text,
  add column if not exists kaggle_key text;

-- Hard-cap input length (a Kaggle key is 32 hex chars; usernames are short).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_kaggle_username_len'
  ) then
    alter table public.profiles
      add constraint profiles_kaggle_username_len
      check (kaggle_username is null or char_length(kaggle_username) <= 64);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'profiles_kaggle_key_len'
  ) then
    alter table public.profiles
      add constraint profiles_kaggle_key_len
      check (kaggle_key is null or char_length(kaggle_key) <= 256);
  end if;
end $$;
