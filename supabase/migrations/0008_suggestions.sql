-- Feature suggestions from visitors, read by officers.
--
-- Anyone can send one from /suggest, with no sign-in, so this is the one table a
-- signed-out visitor causes rows in. They still never write through the API:
-- the insert goes through a server action holding the service role, which
-- checks the length limits, a honeypot and a submission cap first.
--
-- Unlike every other table, nothing here is publicly readable. A suggestion can
-- carry a student's name and whatever they chose to write, and only officers
-- need to see it, so row level security is on with no policies at all: the anon
-- key can neither read nor write, and officer screens read with the service
-- role after checking the passcode.

create type public.suggestion_status as enum ('new', 'planned', 'done', 'declined');

create table if not exists public.suggestions (
  id uuid primary key default gen_random_uuid(),
  body text not null check (char_length(body) between 1 and 2000),
  -- Optional. Blank means the sender chose to stay anonymous.
  name text check (name is null or char_length(name) between 1 and 80),
  status public.suggestion_status not null default 'new',
  created_at timestamptz not null default now()
);

-- The officer tab lists newest first, and the submission cap counts recent rows.
create index if not exists suggestions_created_at_idx
  on public.suggestions (created_at desc);

alter table public.suggestions enable row level security;

comment on table public.suggestions is
  'Feature suggestions sent from the public /suggest page. Officers only: '
  'no RLS policies, so only the service role reads or writes.';
comment on column public.suggestions.status is
  'new until an officer triages it. The officer tab badge counts new rows.';
