# Chevaliers Chess Club

Standings and Swiss pairings for a school chess club. One season is one ongoing
Swiss event; one club meeting is one round.

Next.js (App Router) · TypeScript · Tailwind · Supabase · Vercel.

## Setup

You need the Supabase project, GitHub repo, Vercel connection and Google OAuth
credentials to exist before the app will run.

**To just get it running on your own machine, do steps 1, 4, 5 and 6 and skip 2
and 3.** GitHub and Vercel only matter once you want the club to reach it, and
nothing about them changes the local setup.

### 1. Supabase project

1. In your Supabase account, **New project**. Name it `chevaliers`, pick a region
   near the school, and save the database password somewhere safe.
2. Wait for it to finish provisioning, then go to **Project Settings → Data API**
   and copy the **Project URL**.
3. Go to **Project Settings → API Keys** and copy the **anon / public** key and
   the **service_role** key.

Then apply the schema. Open **SQL Editor → New query** and run the two
migrations in order, each as its own query:

1. [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) —
   tables, row level security and the sign-up trigger.
2. [`supabase/migrations/0002_club_settings.sql`](supabase/migrations/0002_club_settings.sql)
   — records which email domain may sign in. The domain is already set to
   `cvisc.pshs.edu.ph`; edit that line before running if it ever changes.

Both are required. Sign-in fails with a clear error until 0002 has run, because
the app checks the domain but the database enforces it independently — an
account that reaches Supabase without going through the site still gets nowhere.

To change the domain later, no migration is needed:

```sql
update public.club_settings set email_domain = 'new-domain.edu', updated_at = now();
```

### 2. GitHub repo

1. Create a **new empty repo** in your GitHub account — no README, no
   `.gitignore`, no licence, since this directory already has commits.
2. Back here, connect and push:

```bash
git remote add origin https://github.com/<your-username>/<repo-name>.git
git push -u origin main
```

### 3. Vercel

1. In Vercel, **Add New → Project**, and import the repo you just pushed.
2. Framework preset should detect **Next.js**. Leave the build settings alone.
3. Before deploying, add the four environment variables from
   [`.env.example`](.env.example) under **Environment Variables**. Set them for
   Production, Preview and Development.
4. Deploy. Note the production URL — you need it in the next step.

### 4. Google OAuth

You do **not** need the school's Google Workspace, and you do **not** need a
billing account. Use any personal Gmail. Google pushes a "start free trial" /
payment-and-tax prompt at several points — dismiss it every time. Creating an
OAuth client is free and never asks for a card.

Members still sign in with their `@cvisc.pshs.edu.ph` addresses. Google is only
the identity provider; the school domain is enforced by this app and by Postgres.

Google reorganised this area into **Google Auth Platform**, so older guides
describing an "OAuth consent screen" page are out of date.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and sign in
   with your personal Gmail.
2. Top-left project selector → **New project**. Name it `chevaliers`, create it,
   then make sure it is the selected project.
3. Navigation menu → **Google Auth Platform** → **Get started**.
   - **Branding**: app name (`Chevaliers Chess Club`) and your email as support
     contact.
   - **Audience**: choose **External**.
   - **Contact information**: your email again.
4. Still under **Audience**, leave the app in **Testing** and add every club
   member's `@cvisc.pshs.edu.ph` address under **Test users** (100 max). In
   Testing mode only these accounts can sign in, so this doubles as your
   allowlist. No publishing or app verification is needed.
5. **Clients** → **Create client** → Application type **Web application**.
6. Under **Authorised redirect URIs**, add your Supabase callback. Find it in
   Supabase under **Authentication → Providers → Google**; it looks like:
   `https://<project-ref>.supabase.co/auth/v1/callback`
7. Create, then copy the **Client ID** and **Client secret**.
8. In Supabase, **Authentication → Providers → Google**: enable it, paste the ID
   and secret, save.
9. In Supabase, **Authentication → URL Configuration**, add both of these under
   **Redirect URLs**:
   - `http://localhost:3000/auth/callback`
   - `https://<your-vercel-domain>/auth/callback` — once you have deployed

   Set **Site URL** to `http://localhost:3000` while working locally, and change
   it to the Vercel URL when you deploy.

Every test user has to be added by hand, so if the club grows past a rough
hundred, or you get tired of adding people, that is the point to revisit
passwordless email sign-in instead.

### 5. Local environment

`.env.local` already exists with the school domain filled in. Open it and paste
the three Supabase values from step 1 into the blanks, then:

```bash
npm install
npm run dev
```

The app refuses to start with a named error if any value is still blank, rather
than failing later with something cryptic.

### 6. Make yourself an officer

Roles are not self-service. Sign in once so your profile row is created, then in
Supabase go to **Table Editor → profiles**, find your row, and change `role` from
`member` to `officer`.

## Everyday use

- **Members** see the standings.
- **Officers** additionally get *Run a round*: start a round, tick off who turned
  up, generate the pairings, enter results, close the round.

Check-ins lock once pairings exist. Use *Clear and re-pair* if someone arrives
late — the round is regenerated from scratch rather than patched.

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
