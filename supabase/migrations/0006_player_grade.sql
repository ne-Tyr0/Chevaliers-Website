-- Grade and section, as the club's own pairing sheets identify people.
--
-- Nullable: a player added in a hurry mid-meeting should not be blocked on it,
-- and it goes stale every school year, so nothing may depend on it being set.

alter table public.players add column if not exists grade text;

comment on column public.players.grade is
  'Grade and section, e.g. 7-Diamond. Display only; nothing computes from it.';
