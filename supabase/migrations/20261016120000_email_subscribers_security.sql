-- Lock down newsletter table: public may only subscribe via RPC (no direct SELECT/UPDATE/DELETE).

do $$
declare
  pol record;
begin
  for pol in
    select policyname
    from pg_policies
    where schemaname = 'public' and tablename = 'email_subscribers'
  loop
    execute format('drop policy if exists %I on public.email_subscribers', pol.policyname);
  end loop;
end $$;

revoke all on table public.email_subscribers from anon, authenticated;

create or replace function public.subscribe_newsletter(p_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := lower(trim(p_email));
begin
  if length(normalized) < 5 or position('@' in normalized) < 2 then
    raise exception 'invalid email' using errcode = '22023';
  end if;

  insert into public.email_subscribers (email)
  values (normalized);
end;
$$;

revoke all on function public.subscribe_newsletter(text) from public;
grant execute on function public.subscribe_newsletter(text) to anon, authenticated;

comment on function public.subscribe_newsletter(text) is
  'Insert-only newsletter signup; bypasses direct PostgREST access to email_subscribers.';
