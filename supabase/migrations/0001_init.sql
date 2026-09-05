-- Chevaliers Chess Club — initial schema.
--
-- One season is one ongoing Swiss event; one club meeting is one round.
-- Match history lives entirely in `pairings`, so rematch avoidance and both
-- tiebreaks are derived rather than stored.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create type public.member_role as enum ('member', 'officer');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  email text not null,
  role public.member_role not null default 'member',
  -- Persistent random integer assigned on a player's first game. A deliberate
  -- placeholder for a rating: it only ever acts as the sort key inside a score
  -- group, so a real rating can replace it without touching the pairing rules.
  pairing_number integer,
  created_at timestamptz not null default now()
);

comment on column public.profiles.pairing_number is
  'Neutral stand-in for a rating; sorts players within a score group.';

-- ---------------------------------------------------------------------------
-- seasons, rounds, check-ins, pairings
-- ---------------------------------------------------------------------------

create type public.season_status as enum ('active', 'completed');
create type public.round_status as enum ('pending', 'in_progress', 'completed');
create type public.piece_color as enum ('white', 'black');
create type public.pairing_result as enum ('pending', 'a_win', 'b_win', 'draw');

create table public.seasons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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
  player_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

create table public.pairings (
  id uuid primary key default gen_random_uuid(),
  round_id uuid not null references public.rounds (id) on delete cascade,
  board_number integer not null check (board_number > 0),
  player_a_id uuid not null references public.profiles (id) on delete restrict,
  -- Null means player A has the bye that round.
  player_b_id uuid references public.profiles (id) on delete restrict,
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
-- New sign-ups get a profile automatically
-- ---------------------------------------------------------------------------

-- The domain sign-ups are restricted to. Set once per project, before anyone
-- signs in:
--
--   alter database postgres set app.allowed_email_domain = 'your-school.edu';
--
-- The application checks this too, via ALLOWED_EMAIL_DOMAIN. It is repeated
-- here because the check has to hold even if someone reaches Supabase without
-- going through the app: without a profile row an account can read nothing.
create or replace function public.allowed_email_domain()
returns text
language sql
stable
as $$
  select lower(nullif(current_setting('app.allowed_email_domain', true), ''));
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  domain text := public.allowed_email_domain();
begin
  if domain is null then
    raise exception using
      message = 'Sign-in is not configured yet.',
      detail  = 'No allowed email domain is set for this project.',
      hint    = 'Run: alter database postgres set app.allowed_email_domain = ''your-school.edu'';';
  end if;

  if lower(new.email) not like '%@' || domain then
    raise exception using
      message = 'That account is not part of the club.',
      detail  = format('Only %s addresses can sign in.', domain);
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

-- Checking the caller's role through a security-definer function keeps the
-- profiles policies from recursing into themselves.
create or replace function public.is_officer()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'officer'
  );
$$;

alter table public.profiles enable row level security;
alter table public.seasons enable row level security;
alter table public.rounds enable row level security;
alter table public.round_check_ins enable row level security;
alter table public.pairings enable row level security;

-- Holding a profile row is what makes someone a club member, so every read is
-- gated on that rather than on merely being signed in. Within the club,
-- standings and pairings are open to everyone.
create or replace function public.is_member()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from public.profiles where id = auth.uid());
$$;

create policy "members read profiles" on public.profiles
  for select to authenticated using (public.is_member());
create policy "members read seasons" on public.seasons
  for select to authenticated using (public.is_member());
create policy "members read rounds" on public.rounds
  for select to authenticated using (public.is_member());
create policy "members read check-ins" on public.round_check_ins
  for select to authenticated using (public.is_member());
create policy "members read pairings" on public.pairings
  for select to authenticated using (public.is_member());

-- A member may edit their own display name, and nothing else. Role and
-- pairing_number are guarded by the trigger below.
create policy "members update own profile" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "officers update any profile" on public.profiles
  for update to authenticated
  using (public.is_officer())
  with check (public.is_officer());

-- Running a round is officer-only.
create policy "officers write seasons" on public.seasons
  for all to authenticated
  using (public.is_officer()) with check (public.is_officer());
create policy "officers write rounds" on public.rounds
  for all to authenticated
  using (public.is_officer()) with check (public.is_officer());
create policy "officers write check-ins" on public.round_check_ins
  for all to authenticated
  using (public.is_officer()) with check (public.is_officer());
create policy "officers write pairings" on public.pairings
  for all to authenticated
  using (public.is_officer()) with check (public.is_officer());

-- A member updating their own row must not be able to promote themselves or
-- rewrite their pairing number. RLS can gate the row but not the column, so
-- this trigger holds the sensitive fields steady for non-officers.
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_officer() then
    return new;
  end if;

  new.role := old.role;
  new.pairing_number := old.pairing_number;
  new.email := old.email;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();
