-- A pairing becomes a matchup of several games.
--
-- Two players now meet for three games rather than one, and the season is
-- scored on game points: a 2-1 matchup is worth 2 to the winner and 1 to the
-- loser. Colours are recorded per game, because they are decided at the board
-- rather than by the pairing engine.
--
-- Safe to run on live data. Every existing pairing is converted into a matchup
-- of exactly one game carrying its current result and colours, so rounds
-- recorded before this change keep scoring correctly rather than vanishing.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references public.pairings (id) on delete cascade,
  game_number integer not null check (game_number > 0),
  -- Which pieces player A had. Player B's colour is the opposite.
  color_a public.piece_color,
  result public.pairing_result not null default 'pending',
  -- Who last touched this, so a disputed result can be traced back to the
  -- officer or arbiter who entered it. Reconstructing this later is impossible.
  updated_by text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  unique (pairing_id, game_number)
);

create index games_pairing_id_idx on public.games (pairing_id);

-- Carry existing results across. A bye has no games, so it is skipped.
insert into public.games (pairing_id, game_number, color_a, result, updated_by)
select id, 1, color_a, result, 'migrated'
from public.pairings
where player_b_id is not null;

-- The matchup no longer holds a result or colours; both live on its games and
-- the aggregate is derived. Two sources of truth would drift.
alter table public.pairings drop constraint if exists pairings_colors_match_bye;
alter table public.pairings drop column if exists color_a;
alter table public.pairings drop column if exists color_b;
alter table public.pairings drop column if exists result;

alter table public.games enable row level security;

create policy "anyone reads games" on public.games
  for select to anon, authenticated using (true);

-- No write policies, deliberately: officer and arbiter actions run server-side
-- under the service role after checking a passcode.
