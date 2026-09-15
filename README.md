# Chevaliers Chess Club

Standings and Swiss pairings for a school chess club. One season is one ongoing
Swiss event; one club meeting is one round.

Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.

## How it works

A round pairs every active player into a **matchup**: three games against the
same opponent. The season is scored on **game points**, so a matchup ending 2-1
is worth 2 to the winner and 1 to the loser.

There are no accounts, just two shared passcodes.

- **Everyone** — standings, results and a page per player, no sign-in. Anyone
  can also send a feature suggestion from the footer; only officers can read
  them.
- **Arbiters** — one screen: the open round's matchups, where they report game
  results and forfeits. No roster, no pairing, no past rounds.
- **Officers** — everything: roster, seasons, pairing, closing rounds, and a
  Suggestions tab to triage what visitors send. Suggestions need
  [`0008_suggestions.sql`](supabase/migrations/0008_suggestions.sql).

The site speaks in everyday words by default ("points", "free round",
"opponents' strength") and any visitor can switch to chess terms ("score",
"bye", "Buchholz"). Officers choose which one a first-time visitor sees under
**Officer tools → Settings**, which needs
[`0009_site_settings.sql`](supabase/migrations/0009_site_settings.sql); without
it the site simply defaults to everyday words.

Meeting times, how to join and who to contact are shown on the About page and
live in [`src/lib/club/info.ts`](src/lib/club/info.ts). Values in square
brackets are placeholders and show with a dashed outline until replaced.

Both cookies last 30 days per device. Changing a passcode signs everyone out of
that role.

Players are roster entries officers add by name. Nobody logs in as a player, so
nothing depends on Google, a school Workspace, or sending email.

The `players` table already has a `user_id` column reserved, so adding real
accounts later means linking logins to existing players rather than rebuilding.

## Setup

Two things to create: a Supabase project, and — when you want it public — a
Vercel deployment. No Google Cloud, no OAuth, no SMTP.

### 1. Supabase project

1. In your Supabase account, **New project**. Name it `chevaliers`, pick a region
   near the school, and save the database password somewhere safe.
2. Once it finishes provisioning, **Project Settings → Data API** → copy the
   **Project URL**.
3. **Project Settings → API Keys** → copy the **anon / public** key and the
   **service_role** key.

Then apply the schema. Open **SQL Editor → New query**, paste the whole of
[`supabase/migrations/0003_public_site.sql`](supabase/migrations/0003_public_site.sql)
and run it, then
[`0004_forfeits.sql`](supabase/migrations/0004_forfeits.sql) and
[`0005_matchup_games.sql`](supabase/migrations/0005_matchup_games.sql), each as
its own query, in order.

`0003` is self-contained: on a fresh project it is the only migration you
need. If you already ran `0001` and `0002` from the earlier account-based
design, it drops those tables and replaces them — safe now, but it would destroy
a season you cared about, so do not re-run it later.

### 2. Local environment

`.env.local` already exists. Fill in the three Supabase values from step 1, and
change `OFFICER_PASSCODE` to something only officers will know. Then:

```bash
npm install
npm run dev
```

The app refuses to start with a named error if any value is blank, rather than
failing later with something cryptic.

### 3. First run

Open <http://localhost:3000>.

1. Follow **Officer & arbiter sign-in** in the footer and enter your passcode.
2. Add the club on the **Roster** tab by name. This works with or without a
   season.
3. **Start season** — name it for the term or year.
4. On **This round**, the four steps walk you through it: **Start round 1**,
   then **Pair players automatically**. Every active player is paired — there
   is no check-in step.
5. Open a match to record who had White in each game and how it finished.
6. When every game is in, **Finish round**.

### Catching up on meetings already played

If the club was running before the site existed, enter that history first —
otherwise the engine will pair people who have already met and the standings
will start from nothing.

For each past meeting, in order:

1. **Start round**, setting **Date played** to when it actually happened.
2. Open **Pair players by hand instead**, pick the two players — or *Nobody
   (free round)* — then open the match and fill in its games.
3. **Finish round**, then repeat for the next meeting.

Do not press *Pair players automatically* on a backfilled round — that is for rounds the
site is pairing itself. Once your history is in, the next meeting can be paired
normally and it will take all of it into account.

If you cannot remember who had which colour, pick either way round. It only
nudges colour balance in later rounds; scores and rematch avoidance are
unaffected.

### 4. Deploying to Vercel

1. Push the repo if you have not already:

```bash
git push origin main
```

2. In Vercel, **Add New → Project**, import `Chevaliers-Website`. It detects
   Next.js; leave the build settings alone.
3. Add these under **Environment Variables**, for Production, Preview and
   Development:

| Variable | Where it comes from |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys |
| `OFFICER_PASSCODE` | Choose one. Not the local one |
| `ARBITER_PASSCODE` | Choose one, different again. Optional |

`NEXT_PUBLIC_SITE_URL` is optional — Vercel supplies its own production URL for
link previews, so only set it once the club has its own domain.

4. Deploy, then open the deployment and check the standings load.

### Before you tell anyone the address

- **Change both passcodes.** The ones in `.env.local` have been typed into a
  chat and shared around while building; treat them as public. In Vercel the
  passcodes are the only thing between a passer-by and your results.
- **Decide about the roster names.** Everything on the standings and results
  pages is visible to anyone with the link. If publishing students' full names
  is more than the club wants, use a first name and last initial — the engine
  does not care what the names are.
- **The site is not indexed by search engines.** It is public to anyone with the
  link, but `src/app/robots.ts` keeps it out of Google, so a member's name and
  results do not surface when somebody searches for them. To change that, see
  the comment in that file and the `robots` block in `src/app/layout.tsx`.
- **Check the footer.** The club email and the "built by" line in
  `src/components/site-footer.tsx` are shown to everyone.

## Everyday use

The roster is the field: everyone active is paired every round. If somebody is
away, either retire them beforehand or forfeit their board afterwards.

Under **Change the pairings**, **Remove all pairings and start again** clears
a round so it can be paired from scratch rather than patched.

Retiring a player hides them from future rounds but keeps their games, because
those games count toward other players' tiebreaks.

### Results

Open a match to report its three games. Each game records who had White —
colours are decided at the board, not by the pairing engine — and takes one of
six results. The buttons name the players in everyday wording and use chess
notation when chess terms are switched on:

| Everyday words | Chess terms | Meaning |
| --- | --- | --- |
| *A won* · *Draw* · *B won* | `1–0` `½–½` `0–1` | Played at the board |
| *B absent* | `+ −` | The second-named player did not appear |
| *A absent* | `− +` | The first-named player did not appear |
| *Both absent* | `− −` | Neither appeared |

A forfeit scores like a real result — a win is still a full point — but it was
never played, so it is left out of games played and out of **both tiebreaks**.
That stops a no-show quietly inflating whoever benefited from it.

A bye is worth a whole matchup, so sitting out costs nothing against the players
who won theirs. Its value follows the round: three points in a three-game round,
one in a round recorded as a single game. Like a forfeit, it contributes nothing
to either tiebreak.

Finishing a round with games still unreported offers to record them all as
both absent (`− −`), matching the rule that a game not completed by the end of
the round is forfeited.

### Player pages

Every name on the standings and results links to that player's page, also
reachable from **Players**, which has a search box. It shows their place,
points, games played, won/drawn/lost, colour balance, both tiebreaks and every
match of the season.

## Colours are per round

Ticking **Record who had White** when starting a round decides whether it asks
for colours at all. Leave it unticked for a round being keyed in from paper,
where nobody wrote them down — those games stay blank instead of showing
"colours not recorded" on every line, and the round says so once in its heading.

It can be changed while a round is still open. Turning it off keeps any colours
already entered rather than wiping them: nothing reads a colour from a round
that does not track them, so the values are inert, and deleting correct
information over a change of mind would be worse.

Scores and both tiebreaks never involve colour, so a round without it is not
second-class. The only thing affected is colour balancing in future pairings,
which works from whichever rounds do have the information.

## Going back over a closed round

The **All rounds** tab in officer tools lists every round of the season.
Opening a finished one shows it as it stands and asks for the officer passcode again before
anything can be changed.

That second step is there because scores and both tiebreaks are *derived* from
games rather than stored, so correcting a round 1 result moves every score and
tiebreak after it. The permission lasts fifteen minutes and then lapses by
itself; **Lock again now** ends it early. Arbiters never get it.

What can be corrected is results and colours. **Pairings cannot** — changing who
faced whom in a round that has been played would invent games nobody sat down
for. Editing a closed round leaves it closed, so it never blocks the next round
from starting.

## How the pairing works

Round 1 shuffles the checked-in players at random and assigns each of them a
permanent `pairing_number` the first time they play.

Every later round:

1. Group players by cumulative season score in game points (win 1, draw ½,
   loss 0 per game; a bye is worth a whole matchup).
2. Sort each group by `pairing_number`.
3. Fold the top half onto the bottom half — 1st plays the middle player, and so on.
4. Repair the result so nobody replays an opponent, floating players into the
   neighbouring score group where necessary.
5. Prefer pairings whose colour needs complement, using the colours actually
   recorded so far. Colours themselves are entered per game by whoever reports
   the result.
6. If the field is odd, the bye goes to the lowest scorer who has not had one.

Two players who were paired count as having met even if the game was forfeited,
so the engine will not keep pairing the same people around a no-show.

`pairing_number` is a random integer standing in for a rating. It only ever acts
as the sort key inside a score group, so a real rating can replace it by passing
a different `seedOf` to `pairRound` — see
[`src/lib/swiss/pairing.ts`](src/lib/swiss/pairing.ts). Nothing else changes.

### When a repeat is unavoidable

Small fields genuinely run out of legal pairings. Six players after three rounds
can split into two groups of three who have all played each other, at which point
no rematch-free round exists at all. Rather than fail, the engine uses the fewest
repeats possible and marks those boards, and the officer screen says so. This is
the one place the "no rematches" rule bends, and only when the alternative is no
round.

## Security model

Row level security allows `select` and nothing else — there are no insert,
update or delete policies anywhere, deliberately. So even though the anon key is
visible in the page source, it cannot change anything.

Every write happens in a server action that checks a passcode and then uses the
service role key, which stays on the server and never reaches the browser.
Officer-only actions check for the officer role specifically; reporting results
accepts either role. The cookie holds an HMAC derived from the passcode rather
than the passcode itself, so changing a passcode signs everyone out of that role.

Each game records which role last changed it, so a disputed result can be traced
back. That cannot be reconstructed after the fact, which is why it is stored as
it happens.

## Development

```bash
npm run dev          # dev server
npm test             # pairing and standings tests
npm run lint
npm run build
```

The pairing engine in `src/lib/swiss/` is pure and has no Supabase dependency, so
it can be tested directly. `src/lib/swiss/__tests__/harness.ts` simulates whole
seasons and checks the invariants that matter: no repeated match-up unless one is
mathematically forced, byes only to players who have not had one, colour counts
inside the standard tolerance, and mid-season joiners entering on zero.
