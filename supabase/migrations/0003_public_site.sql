-- Drop accounts entirely; the site becomes publicly readable and officers are
-- gated by a shared passcode held by the application.
--
-- DESTRUCTIVE. This drops the tables from 0001/0002 and recreates them. It is
-- safe to run now because no club data exists yet — do not run it against a
-- season you care about.
--
-- What changes:
--   * `profiles` (which hung off auth.users) becomes `players`, a plain roster
--     table officers maintain by hand. No sign-in, no email, no roles.
--   * Everything is readable by anyone, including signed-out visitors.
--   * Nothing is writable through the API at all. Every write goes through a
--     server action holding the service role key, which bypasses RLS, and those
--     actions check the officer passcode first. So "no write policy" is the
--     security boundary, not an oversight.
--
-- `players.user_id` is deliberately left in place for when accounts arrive:
-- linking a login to an existing player is then one update, not a migration.

-- ---------------------------------------------------------------------------
-- Tear down the account-based schema
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists profiles_guard_privileges on public.profiles;

drop table if exists public.pairings cascade;
drop table if exists public.round_check_ins cascade;
drop table if exists public.rounds cascade;
drop table if exists public.seasons cascade;
drop table if exists public.profiles cascade;
drop table if exists public.club_settings cascade;

drop function if exists public.handle_new_user() cascade;
drop function if exists public.guard_profile_privileges() cascade;
drop function if exists public.allowed_email_domain() cascade;
drop function if exists public.is_officer() cascade;
drop function if exists public.is_member() cascade;

drop type if exists public.member_role cascade;
drop type if exists public.season_status cascade;
drop type if exists public.round_status cascade;
drop type if exists public.piece_color cascade;
drop type if exists public.pairing_result cascade;

-- ---------------------------------------------------------------------------
-- Rebuild without accounts
-- ---------------------------------------------------------------------------

create extension if not exists "pgcrypto";

create type public.season_status as enum ('active', 'completed');
create type public.round_status as enum ('pending', 'in_progress', 'completed');
create type public.piece_color as enum ('white', 'black');
create type public.pairing_result as enum ('pending', 'a_win', 'b_win', 'draw');

create table public.players (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (full_name <> ''),
  -- Persistent random integer assigned on a player's first game. A deliberate
  -- placeholder for a rating: it only ever acts as the sort key inside a score
  -- group, so a real rating can replace it without touching the pairing rules.
  pairing_number integer,
  -- Set aside for the day members get logins. Null for every hand-added player.
  user_id uuid unique,
  -- Someone who has left the club: kept for history, hidden from check-in.
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column public.players.user_id is
  'Reserved for linking this roster entry to a future login. Unused today.';

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name <> ''),
  status public.season_status not null default 'active',
  created_at timestamptz not null default now()
);

-- At most one season may be active at a time; the officer screen and the
-- standings page both assume "the current season" is unambiguous.
create unique index seasons_single_active
  on public.seasons ((status))
  where status = 'active';

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete cascade,
  round_number integer not null check (round_number > 0),
  played_on date not null default current_date,
  status public.round_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (season_id, round_number)
);

-- Who actually turned up. Attendance varies week to week, so the pairing pool
-- is this table rather than the whole roster.
create table public.round_check_ins (
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null references public.players (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  board_number integer not null check (board_number > 0),
  player_a_id uuid not null references public.players (id) on delete restrict,
  -- Null means player A has the bye that round.
  player_b_id uuid references public.players (id) on delete restrict,
  color_a public.piece_color,
  color_b public.piece_color,
  result public.pairing_result not null default 'pending',
  -- True when the engine had to repeat an earlier meeting because the round
  -- admitted no alternative. Shown in the UI so it does not look like a bug.
  is_rematch boolean not null default false,
  created_at timestamptz not null default now(),

  unique (round_id, board_number),
  constraint pairings_distinct_players check (player_a_id <> player_b_id),
  -- A bye has no opponent and no colors; a real board has both colors, opposed.
  constraint pairings_colors_match_bye check (
    (player_b_id is null and color_a is null and color_b is null)
    or (player_b_id is not null and color_a is not null and color_b is not null
        and color_a <> color_b)
  )
);

create index pairings_round_id_idx on public.pairings (round_id);
create index pairings_player_a_idx on public.pairings (player_a_id);
create index pairings_player_b_idx on public.pairings (player_b_id);
create index rounds_season_id_idx on public.rounds (season_id);

-- A player may appear on at most one board per round, whether or not it is a bye.
create unique index pairings_one_board_per_player_per_round
  on public.pairings (round_id, player_a_id);
create unique index pairings_one_board_per_opponent_per_round
  on public.pairings (round_id, player_b_id)
  where player_b_id is not null;

-- ---------------------------------------------------------------------------
-- Row level security: readable by everyone, writable by no one
-- ---------------------------------------------------------------------------

alter table public.players enable row level security;
alter table public.seasons enable row level security;
alter table public.rounds enable row level security;
alter table public.round_check_ins enable row level security;
alter table public.pairings enable row level security;

create policy "anyone reads players" on public.players
  for select to anon, authenticated using (true);
create policy "anyone reads seasons" on public.seasons
  for select to anon, authenticated using (true);
create policy "anyone reads rounds" on public.rounds
  for select to anon, authenticated using (true);
create policy "anyone reads check-ins" on public.round_check_ins
  for select to anon, authenticated using (true);
create policy "anyone reads pairings" on public.pairings
  for select to anon, authenticated using (true);

-- No insert, update or delete policies anywhere, on purpose. With RLS enabled
-- and no permissive policy, the anon and authenticated roles cannot write even
-- if someone takes the public key out of the page source and calls the API
-- directly. Officer actions run server-side under the service role instead.
