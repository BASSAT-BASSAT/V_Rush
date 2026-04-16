-- Optional profile fields for KernelLab UI
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists phone text,
  add column if not exists bio text;
