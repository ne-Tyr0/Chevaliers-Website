-- Forfeit results, and the end of attendance tracking.
--
-- Safe to run on a database with data in it: no table is dropped except
-- round_check_ins, which the application no longer reads.

-- ---------------------------------------------------------------------------
-- Forfeit results
-- ---------------------------------------------------------------------------
--
-- A forfeit scores like a win but was never played, so it must not feed the
-- tiebreaks. The application handles that; the database only needs to be able
-- to record it.
--
-- The enum is rebuilt rather than extended with `alter type ... add value`,
-- because that cannot be used in the same transaction that then relies on the
-- new value — and the Supabase SQL editor runs a whole script as one.

alter table public.pairings alter column result drop default;
alter table public.pairings alter column result type text using result::text;

drop type public.pairing_result;

create type public.pairing_result as enum (
  'pending',
  'a_win',
  'b_win',
  'draw',
  -- White's opponent did not appear.
  'a_forfeit_win',
  -- Black's opponent did not appear.
  'b_forfeit_win',
  -- Neither player appeared; nobody scores.
  'double_forfeit'
);

alter table public.pairings
  alter column result type public.pairing_result
  using result::public.pairing_result;

alter table public.pairings alter column result set default 'pending';

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
--
-- Check-in is gone: every active player is in every round, and anyone who does
-- not complete their game by the end of the round is forfeited instead. That
-- suits a small club where the roster and the field are the same thing.

drop table if exists public.round_check_ins cascade;
