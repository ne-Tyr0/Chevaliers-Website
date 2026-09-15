-- Site-wide settings officers can change without a deploy.
--
-- One row, enforced by a boolean primary key that can only be true. For now it
-- holds a single choice: whether a first-time visitor sees the site in everyday
-- words or in chess terms (Buchholz, bye, 1–0). Each visitor can still flip it
-- for themselves; this is only where they start.
--
-- Readable by anyone, because every public page needs it to render. Written
-- only through a server action that checks the officer passcode, like every
-- other table.

create table if not exists public.site_settings (
  id boolean primary key default true check (id),
  chess_terms_default boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (true) on conflict (id) do nothing;

alter table public.site_settings enable row level security;

drop policy if exists "anyone reads site settings" on public.site_settings;
create policy "anyone reads site settings" on public.site_settings
  for select using (true);

comment on table public.site_settings is
  'Single row of site-wide settings. Readable by anyone; written by officer actions only.';
comment on column public.site_settings.chess_terms_default is
  'False: visitors start in everyday words. True: they start in chess terms. '
  'Either way each visitor can switch for themselves.';
