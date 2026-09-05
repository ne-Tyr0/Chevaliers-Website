# Chevaliers Chess Club

Standings and Swiss pairings for a school chess club. One season is one ongoing
Swiss event; one club meeting is one round.

Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.

## How access works

There are no accounts. Anyone can read the standings; officers unlock the round
tools with a shared passcode.

- **Everyone** — standings and pairings, no sign-in.
- **Officers** — enter the passcode once, then manage the roster, run rounds and
  enter results. The cookie lasts 30 days per device.

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
and run it.

That file is self-contained: on a fresh project it is the only migration you
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

1. Go to **Officers** and enter your passcode.
2. **Start season** — name it for the term or year.
3. Add the club to the **Roster** by name.
4. **Start round 1**, check in whoever turned up, **Generate pairings**.
5. Enter results as boards finish, then **Close round**.

### 4. Deploying, when you are ready

1. Create an empty GitHub repo — no README or `.gitignore`, since this directory
   already has commits — then:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

2. In Vercel, **Add New → Project**, and import the repo. It detects Next.js.
3. Add the four variables from [`.env.example`](.env.example) under **Environment
   Variables**, for Production, Preview and Development.
4. Deploy.

**Change `OFFICER_PASSCODE` before you deploy.** Once the site is public that
passcode is the only thing between a passer-by and your results.

**Decide what names go on the roster, too.** The standings page is public, so
whatever officers type is visible to anyone with the link. If publishing
students' full names is more than you want, use a first name and last initial.

## Everyday use

Check-ins lock once pairings exist. Use **Clear and re-pair** if someone arrives
late — the round is regenerated from scratch rather than patched.

Retiring a player hides them from check-in but keeps their games, because those
games count toward other players' tiebreaks.

## How the pairing works

Round 1 shuffles the checked-in players at random and assigns each of them a
permanent `pairing_number` the first time they play.

Every later round:

1. Group players by cumulative season score (win 1, draw ½, loss 0, bye 1).
2. Sort each group by `pairing_number`.
3. Fold the top half onto the bottom half — 1st plays the middle player, and so on.
4. Repair the result so nobody replays an opponent, floating players into the
   neighbouring score group where necessary.
5. Assign colours, alternating from each player's previous round and keeping
   everyone's White/Black counts as level as possible.
6. If the field is odd, the bye goes to the lowest scorer who has not had one.

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

Every write happens in a server action that checks the officer passcode and then
uses the service role key, which stays on the server and never reaches the
browser. The officer cookie holds an HMAC derived from the passcode rather than
the passcode itself, so changing `OFFICER_PASSCODE` signs everyone out.

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
