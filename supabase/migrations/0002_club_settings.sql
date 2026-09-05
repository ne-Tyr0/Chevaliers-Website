-- Move the allowed email domain out of a database-level setting and into a table.
--
-- 0001 read it from `current_setting('app.allowed_email_domain')`, which needs
-- `alter database ... set`. On Supabase that is refused: the `postgres` role is
-- not the database owner. It would also have been unreliable even with the
-- privilege, because such a setting only applies to new connections and
-- Supabase pools them.
--
-- A one-row table has neither problem, and it lets an officer change the domain
-- later without a migration.

create table public.club_settings (
  -- Enforces exactly one row: the primary key can only ever hold `true`.
  id boolean primary key default true check (id),
  email_domain text not null check (email_domain <> ''),
  updated_at timestamptz not null default now()
);

comment on table public.club_settings is
  'Single row. Club-wide configuration that must be enforced inside the database.';

insert into public.club_settings (email_domain)
values ('cvisc.pshs.edu.ph');

alter table public.club_settings enable row level security;

create policy "members read settings" on public.club_settings
  for select to authenticated using (public.is_member());

create policy "officers write settings" on public.club_settings
  for all to authenticated
  using (public.is_officer()) with check (public.is_officer());

-- Security definer so the sign-up trigger can still read the domain for someone
-- who has no profile row yet — which is every member, the first time they sign in.
create or replace function public.allowed_email_domain()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(email_domain) from public.club_settings where id;
$$;

-- Re-declare the sign-up trigger so its error hint points at this table rather
-- than at the database setting that 0001 could not use.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_domain text := public.allowed_email_domain();
begin
  if allowed_domain is null then
    raise exception using
      message = 'Sign-in is not configured yet.',
      detail  = 'No allowed email domain is recorded for this club.',
      hint    = 'Run supabase/migrations/0002_club_settings.sql, or insert a row into public.club_settings.';
  end if;

  if lower(new.email) not like '%@' || allowed_domain then
    raise exception using
      message = 'That account is not part of the club.',
      detail  = format('Only %s addresses can sign in.', allowed_domain);
  end if;

  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
