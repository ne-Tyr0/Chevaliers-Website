-- Who runs the club each school year: officers and the adviser.
--
-- One row per position held, per school year, so past years are kept rather
-- than overwritten when officers hand over. A position is held either by a
-- roster player (linked, so their page and grade stay in step) or by someone
-- who is not on the roster, such as the adviser, named directly.
--
-- Public: the Players page lists them. Written only through officer server
-- actions, like every other table.

create table if not exists public.club_officers (
  id uuid primary key default gen_random_uuid(),
  -- Stored as "2026-2027"; shown with an en dash.
  school_year text not null check (school_year ~ '^[0-9]{4}-[0-9]{4}$'),
  position text not null check (char_length(position) between 1 and 60),
  player_id uuid references public.players(id) on delete cascade,
  name text check (name is null or char_length(name) between 1 and 120),
  -- A short public line: "Ask me about joining", or a contact.
  message text check (message is null or char_length(message) between 1 and 160),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint club_officers_has_person check (player_id is not null or name is not null)
);

create index if not exists club_officers_year_order_idx
  on public.club_officers (school_year desc, sort_order);

alter table public.club_officers enable row level security;

drop policy if exists "anyone reads club officers" on public.club_officers;
create policy "anyone reads club officers" on public.club_officers
  for select using (true);

comment on table public.club_officers is
  'Officers and advisers by school year, shown on the public Players page. '
  'Readable by anyone; written by officer actions only.';
comment on column public.club_officers.player_id is
  'The roster player holding the position. Null for someone not on the roster, '
  'such as the adviser, who is named in `name` instead.';
comment on column public.club_officers.message is
  'Optional one-line public message or contact. Shown to everyone.';
