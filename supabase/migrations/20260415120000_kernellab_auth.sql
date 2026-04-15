-- KernelLab: profiles, newsletter emails, usage logs
-- Run in Supabase SQL Editor or via CLI after linking the project.

-- Profiles (synced from auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- New user → profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Newsletter / waitlist (public insert only)
create table if not exists public.email_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  created_at timestamptz not null default now(),
  constraint email_subscribers_email_key unique (email)
);

alter table public.email_subscribers enable row level security;

create policy "Anyone can subscribe with an email"
  on public.email_subscribers for insert
  with check (
    length(trim(email)) > 3
    and position('@' in trim(email)) > 1
  );

-- Usage / audit log (authenticated users only)
create table if not exists public.usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  action text not null default 'process_pipeline',
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists usage_logs_user_id_created_at_idx
  on public.usage_logs (user_id, created_at desc);

alter table public.usage_logs enable row level security;

create policy "Users insert own usage logs"
  on public.usage_logs for insert
  with check (auth.uid() = user_id);

create policy "Users read own usage logs"
  on public.usage_logs for select
  using (auth.uid() = user_id);
