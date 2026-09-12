-- Whether a round records which player had White.
--
-- The club played its early rounds without noting colours down. Rather than
-- show every one of those games as "colours not recorded", or guess at them, a
-- round now says whether it tracks colours at all. Backfilled rounds are
-- created with this off; rounds run on the site have it on.
--
-- Defaults to true so a round created without thinking about it behaves the way
-- a properly run round should.

alter table public.rounds
  add column if not exists tracks_colors boolean not null default true;

comment on column public.rounds.tracks_colors is
  'False for rounds entered from paper where nobody recorded who had White. '
  'The colour picker is hidden for such a round and its games keep color_a null.';
