import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StepKnight } from "@/components/chess-motion";
import { CheckIcon, ChevronDown, ChevronRight, LockIcon } from "@/components/icons";
import { Pawn } from "@/components/pawn";
import { ListSkeleton } from "@/components/skeletons";
import { StaffMatchList } from "@/components/staff-match-list";
import {
  EmptyState,
  ErrorNote,
  Note,
  PageHeader,
  RoundStatusTag,
  SectionHeading,
  WordingToggle,
  formatDate,
} from "@/components/ui";
import {
  addClubOfficer,
  addManualMatchup,
  addPlayer,
  clearPairings,
  completeRound,
  createSeason,
  deleteMatchup,
  deleteSuggestion,
  generatePairings,
  moveClubOfficer,
  removeClubOfficer,
  setDefaultWording,
  setPlayerActive,
  setSuggestionStatus,
  startRound,
  unlockRole,
  updateClubOfficer,
} from "@/lib/club/actions";
import { CLUB_INFO, isPlaceholder } from "@/lib/club/info";
import {
  formatSchoolYear,
  getOfficerYears,
  OFFICER_MESSAGE_MAX_LENGTH,
  OFFICER_NAME_MAX_LENGTH,
  OFFICER_POSITION_MAX_LENGTH,
  parseSchoolYear,
  schoolYearChoices,
  schoolYearOf,
  SUGGESTED_POSITIONS,
} from "@/lib/club/officers";
import {
  getActiveSeason,
  getRoster,
  getRoundMatchups,
  getSeasonHistory,
} from "@/lib/club/queries";
import {
  countNewSuggestions,
  getSuggestions,
  SUGGESTION_STATUSES,
} from "@/lib/club/suggestions";
import { getDefaultWording, getTerms } from "@/lib/club/wording";
import { currentRole } from "@/lib/officer/session";
import type {
  ClubOfficerRow,
  PlayerRow,
  RoundRow,
  SuggestionRow,
  SuggestionStatus,
} from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Officer tools" };

type OfficerTab = "round" | "rounds" | "roster" | "officers" | "suggestions" | "settings";

const TABS: { id: OfficerTab; label: string }[] = [
  { id: "round", label: "This round" },
  { id: "rounds", label: "All rounds" },
  { id: "roster", label: "Roster" },
  { id: "officers", label: "Officers & adviser" },
  { id: "suggestions", label: "Suggestions" },
  { id: "settings", label: "Settings" },
];

function parseTab(value: unknown): OfficerTab {
  return TABS.some((tab) => tab.id === value) ? (value as OfficerTab) : "round";
}

function tabHref(tab: OfficerTab): string {
  return tab === "round" ? "/officer" : `/officer?tab=${tab}`;
}

export default async function OfficerPage({
  searchParams,
}: PageProps<"/officer">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const role = await currentRole();

  if (role !== "officer") {
    return (
      <>
        <PasscodeGate error={error} signedInAs={role} />
      </>
    );
  }

  const tab = parseTab(params.tab);

  // The tabs go out immediately and each panel streams in behind them, so
  // moving between tabs never waits on the database.
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-14">
      <PageHeader title="Officer tools" />

      <OfficerTabs
        current={tab}
        badge={
          <Suspense fallback={null}>
            <SuggestionsBadge />
          </Suspense>
        }
      />

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="mt-8">
        <Suspense fallback={<ListSkeleton rows={4} />}>
          {tab === "round" ? <RoundPanel /> : null}
          {tab === "rounds" ? <RoundsPanel /> : null}
          {tab === "roster" ? <RosterPanel /> : null}
          {tab === "officers" ? (
            <OfficersPanel
              year={typeof params.year === "string" ? parseSchoolYear(params.year) : null}
            />
          ) : null}
          {tab === "suggestions" ? <SuggestionsPanel /> : null}
          {tab === "settings" ? <SettingsPanel saved={params.saved === "1"} /> : null}
        </Suspense>
      </div>
    </main>
  );
}

/** How many suggestions nobody has triaged, once that count arrives. */
async function SuggestionsBadge() {
  const count = await countNewSuggestions();
  if (!count) return null;
  return (
    <span
      className="bg-ink text-cream min-w-5 rounded-full px-1.5 text-center text-xs leading-5 tabular-nums"
      aria-label={`${count} new`}
    >
      {count}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Signing in
// ---------------------------------------------------------------------------

function PasscodeGate({
  error,
  signedInAs,
}: {
  error: string | null;
  signedInAs: string | null;
}) {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-10 sm:px-6 sm:py-20">
      <Pawn className="mb-6 h-9 w-auto" />
      <h1 className="text-3xl">Officer &amp; arbiter sign-in</h1>
      <p className="text-muted mt-3 leading-relaxed">
        For the people running the club. Officers run rounds and look after the
        roster; arbiters enter results during a meeting. Everyone else can see
        the{" "}
        <Link href="/standings" className="link">
          standings
        </Link>{" "}
        and{" "}
        <Link href="/results" className="link">
          results
        </Link>{" "}
        without signing in.
      </p>

      {signedInAs === "arbiter" ? (
        <p className="card mt-6 p-4 text-sm leading-relaxed">
          You are signed in as an arbiter.{" "}
          <Link href="/arbiter" className="link font-medium">
            Go to Report results
          </Link>
          , or enter the officer passcode below.
        </p>
      ) : null}

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <form action={unlockRole} className="card mt-8 p-5">
        <label className="label block" htmlFor="passcode">
          Passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          required
          className="field mt-1.5"
        />
        <button type="submit" className="btn-primary mt-4 w-full">
          <LockIcon className="size-4" />
          Sign in
        </button>
        <p className="text-muted mt-3 text-sm">
          The passcode decides whether you get officer or arbiter tools. You
          stay signed in on this device for 30 days, or until you press Lock.
        </p>
      </form>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

/**
 * One tab per job, each its own URL, so an action lands back on the tab it was
 * started from and a tab can be bookmarked.
 *
 * On a phone the tabs wrap to a second line rather than scrolling sideways, so
 * all five stay in view and the current one is never hidden off the edge.
 */
function OfficerTabs({
  current,
  badge,
}: {
  current: OfficerTab;
  /** The Suggestions count, which arrives after the tabs themselves. */
  badge: React.ReactNode;
}) {
  return (
    <nav
      aria-label="Officer tools"
      className="mt-6 border-b"
      style={{ borderColor: "var(--rule-strong)" }}
    >
      <ul className="-ml-3 flex flex-wrap gap-x-1">
        {TABS.map((item) => {
          const active = item.id === current;
          return (
            <li key={item.id}>
              <Link
                href={tabHref(item.id)}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-12 items-center gap-2 rounded-t-md px-3 text-[0.9375rem] transition-colors ${
                  active
                    ? "text-ink font-semibold"
                    : "text-muted hover:bg-cream-deep hover:text-ink"
                }`}
              >
                {item.label}
                {item.id === "suggestions" ? badge : null}
                {active ? (
                  <span aria-hidden className="bg-ink absolute inset-x-2 bottom-0 h-[3px] rounded-t" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ---------------------------------------------------------------------------
// This round
// ---------------------------------------------------------------------------

type Phase = "start" | "pair" | "results" | "finish";

const STEPS: { id: Phase; title: string }[] = [
  { id: "start", title: "Start the round" },
  { id: "pair", title: "Pair the players" },
  { id: "results", title: "Enter results" },
  { id: "finish", title: "Finish the round" },
];

/**
 * Running a meeting as four steps, with the current one open and a single
 * main button for it.
 *
 * The old screen showed every control at once, so knowing what to do next
 * meant knowing the whole process already. Numbered, named steps are the
 * pattern NN/g recommends for a sequence like this: they say where you are,
 * what is done, and what comes after.
 */
async function RoundPanel() {
  const season = await getActiveSeason();
  if (!season) return <NewSeasonStep />;

  const [roster, history, terms] = await Promise.all([
    getRoster(),
    getSeasonHistory(season.id),
    getTerms(),
  ]);

  const currentRound = history.rounds.at(-1) ?? null;
  const matches = currentRound ? await getRoundMatchups(currentRound.id) : [];
  const active = roster.filter((p) => p.is_active);
  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));

  const games = matches.flatMap((view) => view.games);
  const outstanding = games.filter((g) => g.result === "pending").length;

  // Hand-pairing 22 boards out of 44 names is unworkable if the list never
  // shrinks, so offer only the players who do not yet have a game this round.
  const seated = new Set<string>();
  for (const { pairing } of matches) {
    seated.add(pairing.player_a_id);
    if (pairing.player_b_id) seated.add(pairing.player_b_id);
  }
  const unpaired = active.filter((player) => !seated.has(player.id));

  const phase: Phase =
    !currentRound || currentRound.status === "completed"
      ? "start"
      : matches.length === 0
        ? "pair"
        : outstanding > 0
          ? "results"
          : "finish";
  const nextNumber = (currentRound?.round_number ?? 0) + 1;
  const roundOpen = currentRound !== null && currentRound.status !== "completed";

  return (
    <div>
      <p className="text-muted">
        {season.name} · {history.rounds.length}{" "}
        {history.rounds.length === 1 ? "round" : "rounds"} so far ·{" "}
        {active.length} active players
      </p>

      <Stepper phase={phase} roundKey={currentRound?.id ?? `${season.id}-new`} />

      <section
        aria-labelledby="step-heading"
        className="mt-6 rounded-xl border-2 p-5 sm:p-6"
        style={{
          borderColor: "var(--color-ink)",
          backgroundColor: "var(--color-cream-light)",
        }}
      >
        <p className="text-muted text-sm">
          Step {STEPS.findIndex((s) => s.id === phase) + 1} of {STEPS.length}
        </p>

        {phase === "start" ? (
          <>
            <h2 id="step-heading" className="mt-1 text-2xl">
              Start round {nextNumber}
            </h2>
            <p className="text-muted mt-2 max-w-prose leading-relaxed">
              {currentRound
                ? `Round ${currentRound.round_number} is finished. `
                : "This is the first round of the season. "}
              Starting a round opens it for pairing. Check the{" "}
              <Link href={tabHref("roster")} className="link">
                roster
              </Link>{" "}
              first: everyone marked active will be paired.
            </p>
            <form action={startRound} className="mt-5 flex flex-wrap items-end gap-4">
              <div>
                <label className="label block" htmlFor="played-on">
                  Date played <span className="font-normal">(leave blank for today)</span>
                </label>
                <input
                  id="played-on"
                  name="playedOn"
                  type="date"
                  className="field mt-1.5 w-auto"
                />
              </div>
              <label className="flex min-h-11 items-center gap-2.5">
                <input
                  type="checkbox"
                  name="tracksColors"
                  defaultChecked
                  className="size-5 accent-[var(--color-ink)]"
                />
                <span>Record who had White</span>
              </label>
              <button type="submit" className="btn-primary">
                Start round {nextNumber}
              </button>
            </form>
            <p className="text-muted mt-3 max-w-prose text-sm leading-relaxed">
              Untick &ldquo;Record who had White&rdquo; only for a round being
              copied in from paper where nobody wrote colours down. You can
              change it while the round is open.
            </p>
          </>
        ) : null}

        {phase === "pair" && currentRound ? (
          <>
            <h2 id="step-heading" className="mt-1 text-2xl">
              Pair the players for round {currentRound.round_number}
            </h2>
            <p className="text-muted mt-2 max-w-prose leading-relaxed">
              All {active.length} active players get an opponent on similar
              points, for a {terms.match} of three games.
              {active.length % 2 === 1
                ? ` There is an odd number, so one player gets a ${terms.bye}.`
                : ""}
            </p>
            <form action={generatePairings} className="mt-5">
              <input type="hidden" name="roundId" value={currentRound.id} />
              <button type="submit" className="btn-primary">
                Pair players automatically
              </button>
            </form>
          </>
        ) : null}

        {phase === "results" && currentRound ? (
          <>
            <h2 id="step-heading" className="mt-1 text-2xl">
              Enter the results of round {currentRound.round_number}
            </h2>
            <p className="text-muted mt-2 max-w-prose leading-relaxed">
              Open each {terms.match} below to enter who had White and how each
              game ended. Arbiters can do this too from their own sign-in.
            </p>
            <Progress done={games.length - outstanding} total={games.length} />
          </>
        ) : null}

        {phase === "finish" && currentRound ? (
          <>
            <h2 id="step-heading" className="mt-1 text-2xl">
              Finish round {currentRound.round_number}
            </h2>
            <p className="text-muted mt-2 max-w-prose leading-relaxed">
              Every game has a result. Finishing the round locks it, and lets you
              start the next one. You can still correct a finished round later
              from All rounds.
            </p>
            {unpaired.length > 0 ? (
              <p className="mt-3 max-w-prose rounded-lg border-2 px-4 py-3" style={{ borderColor: "var(--color-ink)" }}>
                <strong className="font-semibold">
                  {unpaired.length} active {unpaired.length === 1 ? "player has" : "players have"} no {terms.match} this round.
                </strong>{" "}
                Finish only if they were not playing. Otherwise pair them below
                first.
              </p>
            ) : null}
            <form action={completeRound} className="mt-5">
              <input type="hidden" name="roundId" value={currentRound.id} />
              <button type="submit" className="btn-primary">
                <CheckIcon className="size-4" />
                Finish round {currentRound.round_number}
              </button>
            </form>
          </>
        ) : null}
      </section>

      {roundOpen && matches.length > 0 && currentRound ? (
        <section aria-labelledby="matches-heading" className="mt-10">
          <SectionHeading
            id="matches-heading"
            aside={`${matches.length} ${matches.length === 1 ? terms.match : terms.matches}`}
          >
            Round {currentRound.round_number} {terms.matches}
          </SectionHeading>
          <WordingToggle terms={terms} returnTo="/officer" className="mt-3" />
          <div className="mt-4">
            <StaffMatchList
              matches={matches}
              nameById={nameById}
              terms={terms}
              aside={(view) => (
                <form action={deleteMatchup} className="flex justify-end">
                  <input type="hidden" name="pairingId" value={view.pairing.id} />
                  <button
                    type="submit"
                    className="btn-quiet sm:h-full"
                    aria-label={`Remove ${terms.board.toLowerCase()} ${view.pairing.board_number}`}
                  >
                    Remove
                  </button>
                </form>
              )}
            />
          </div>

          {phase === "results" ? (
            <Disclosure title={`Finish without ${outstanding} missing ${outstanding === 1 ? "result" : "results"}`}>
              <p className="text-muted max-w-prose leading-relaxed">
                If some games were never played, finishing now records each of
                them as both players absent: nobody gets a point for them.
              </p>
              <form action={completeRound} className="mt-4">
                <input type="hidden" name="roundId" value={currentRound.id} />
                <input type="hidden" name="forfeitUnplayed" value="true" />
                <button type="submit" className="btn">
                  Finish round, marking {outstanding}{" "}
                  {outstanding === 1 ? "game" : "games"} as not played
                </button>
              </form>
            </Disclosure>
          ) : null}
        </section>
      ) : null}

      {roundOpen && currentRound ? (
        <Disclosure
          title={phase === "pair" ? "Pair players by hand instead" : "Change the pairings"}
          defaultOpen={phase !== "pair" && unpaired.length > 0}
        >
          <ManualMatchupForm
            roundId={currentRound.id}
            players={unpaired}
            totalActive={active.length}
            byeLabel={terms.bye}
          />
          {matches.length > 0 ? (
            <form
              action={clearPairings}
              className="mt-6 border-t pt-5"
              style={{ borderColor: "var(--rule)" }}
            >
              <input type="hidden" name="roundId" value={currentRound.id} />
              <p className="text-muted max-w-prose text-sm leading-relaxed">
                Starting again removes every {terms.match} in this round, along
                with any results already entered for them.
              </p>
              <button type="submit" className="btn mt-3">
                Remove all pairings and start again
              </button>
            </form>
          ) : null}
        </Disclosure>
      ) : null}
    </div>
  );
}

function Stepper({ phase, roundKey }: { phase: Phase; roundKey: string }) {
  const currentIndex = STEPS.findIndex((s) => s.id === phase);
  return (
    <ol
      className="relative mt-6 grid grid-cols-4 gap-2 sm:items-center"
      aria-label="Steps for running a round"
    >
      {STEPS.map((step, index) => {
        const state =
          index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming";
        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            className="flex flex-col items-center gap-1.5 text-center sm:flex-row sm:gap-2.5 sm:text-left"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-semibold ${
                state === "upcoming" ? "text-muted" : "bg-ink text-cream"
              }`}
              style={{
                borderColor: state === "upcoming" ? "var(--rule-strong)" : "var(--color-ink)",
              }}
            >
              {state === "done" ? (
                <CheckIcon className="size-4" />
              ) : state === "current" ? null : (
                index + 1
              )}
            </span>
            <span
              className={`text-xs leading-tight sm:text-sm ${
                state === "current" ? "font-semibold" : "text-muted"
              }`}
            >
              {step.title}
              <span className="sr-only">
                {state === "done" ? " (done)" : state === "current" ? " (current step)" : ""}
              </span>
            </span>
          </li>
        );
      })}
      {/* Stands on the current step's circle, and hops along when one is done. */}
      <StepKnight roundKey={roundKey} step={currentIndex} />
    </ol>
  );
}

function Progress({ done, total }: { done: number; total: number }) {
  return (
    <div className="mt-5 max-w-md">
      <p className="font-medium">
        {done} of {total} games entered
      </p>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full"
        style={{ backgroundColor: "var(--color-cream-deep)" }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-label="Games entered"
      >
        <div
          className="bg-ink h-full rounded-full"
          style={{ width: `${total ? (done / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );
}

/** Less common actions, kept out of the way until asked for. */
function Disclosure({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="card group mt-6" open={defaultOpen}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-medium">
        {title}
        <ChevronDown className="size-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t px-5 py-5" style={{ borderColor: "var(--rule)" }}>
        {children}
      </div>
    </details>
  );
}

function NewSeasonStep() {
  return (
    <section
      className="rounded-xl border-2 p-5 sm:p-6"
      style={{
        borderColor: "var(--color-ink)",
        backgroundColor: "var(--color-cream-light)",
      }}
    >
      <h2 className="text-2xl">Start a season</h2>
      <p className="text-muted mt-2 max-w-prose leading-relaxed">
        No season is running. A season is the whole competition — usually a
        school year or a term — and every round belongs to one. You only need a
        new one when the club starts over from zero points.
      </p>
      <form action={createSeason} className="mt-5 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1 sm:max-w-xs">
          <label className="label block" htmlFor="season-name">
            Season name
          </label>
          <input
            id="season-name"
            name="name"
            required
            placeholder="School Year 2026–2027"
            className="field mt-1.5"
          />
        </div>
        <button type="submit" className="btn-primary">
          Start season
        </button>
      </form>
    </section>
  );
}

/**
 * Add a match by hand.
 *
 * How a club catches up: meetings played before the site existed go in round by
 * round, then each match's games are filled in from its own page.
 */
function ManualMatchupForm({
  roundId,
  players,
  totalActive,
  byeLabel,
}: {
  roundId: string;
  /** Only those without a game in this round — the list shrinks as you pair. */
  players: PlayerRow[];
  totalActive: number;
  byeLabel: string;
}) {
  return (
    <div>
      <p className="text-muted max-w-prose leading-relaxed">
        Choose two players yourself. Only players without a game this round are
        listed, so the choices shrink as you go.{" "}
        <span className="font-medium text-ink">
          {players.length === 0
            ? `All ${totalActive} are paired.`
            : `${players.length} of ${totalActive} still to pair.`}
        </span>
      </p>

      {players.length === 0 ? (
        <p className="text-muted mt-3 text-sm">
          To pair someone differently, remove their current match first.
        </p>
      ) : (
        <>
          <form action={addManualMatchup} className="mt-4 flex flex-wrap items-end gap-3">
            <input type="hidden" name="roundId" value={roundId} />

            <SelectField label="Player" name="playerAId" id="player-a" required>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.full_name}
                </option>
              ))}
            </SelectField>

            <SelectField label="Opponent" name="playerBId" id="player-b">
              <option value="bye">Nobody ({byeLabel})</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.full_name}
                </option>
              ))}
            </SelectField>

            <button type="submit" className="btn-primary">
              Add match
            </button>
          </form>

          <details className="group mt-4">
            <summary className="btn-quiet w-fit list-none">
              <span className="group-open:hidden">See who is still to pair ({players.length})</span>
              <span className="hidden group-open:inline">Hide the list</span>
            </summary>
            <p className="text-muted mt-3 max-w-prose text-sm leading-relaxed">
              {players.map((p) => p.full_name).join(", ")}.
            </p>
          </details>
        </>
      )}
    </div>
  );
}

function SelectField({
  label,
  name,
  id,
  required,
  children,
}: {
  label: string;
  name: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="w-full min-w-0 sm:w-auto sm:flex-1 sm:max-w-xs">
      <label className="label block" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue=""
        className="field mt-1.5"
      >
        <option value="" disabled>
          Choose
        </option>
        {children}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// All rounds
// ---------------------------------------------------------------------------

/**
 * Every round of the season, newest first, as a way back into the ones already
 * finished. Correcting a finished round asks for the passcode again on the way in.
 */
async function RoundsPanel() {
  const season = await getActiveSeason();
  if (!season) {
    return (
      <EmptyState
        action={
          <Link href={tabHref("round")} className="btn">
            Start a season
          </Link>
        }
      >
        No season is running, so there are no rounds yet.
      </EmptyState>
    );
  }

  const history = await getSeasonHistory(season.id);
  const ordered: RoundRow[] = [...history.rounds].sort(
    (a, b) => b.round_number - a.round_number,
  );

  return (
    <section>
      <SectionHeading aside={`${ordered.length} in ${season.name}`}>All rounds</SectionHeading>
      <p className="text-muted mt-2 max-w-prose leading-relaxed">
        Open a round to check or correct its results. Finished rounds ask for the
        passcode again before anything can be changed.
      </p>
      {ordered.length === 0 ? (
        <EmptyState>No rounds yet this season.</EmptyState>
      ) : (
        <ul className="mt-5 space-y-2">
          {ordered.map((round) => (
            <li key={round.id}>
              <Link
                href={`/officer/round/${round.id}`}
                className="card-link flex items-center gap-4 px-4 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Round {round.round_number}</span>
                  <span className="text-muted block text-sm">
                    {formatDate(round.played_on)}
                    {round.tracks_colors ? "" : " · colours not recorded"}
                  </span>
                </span>
                <RoundStatusTag status={round.status} />
                <ChevronRight className="size-5 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

async function RosterPanel() {
  const roster = await getRoster();
  const active = roster.filter((p) => p.is_active).length;

  return (
    <section>
      <SectionHeading aside={`${active} active · ${roster.length - active} retired`}>
        Roster
      </SectionHeading>
      <p className="text-muted mt-2 max-w-prose leading-relaxed">
        Everyone marked active is paired each round. Names appear on the public
        site, so use the form the club is comfortable publishing.
      </p>

      <form action={addPlayer} className="card mt-5 flex flex-wrap items-end gap-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <label className="label block" htmlFor="player-name">
            New player&rsquo;s name
          </label>
          <input
            id="player-name"
            name="fullName"
            required
            placeholder="Surname, Given names"
            className="field mt-1.5"
          />
        </div>
        <button type="submit" className="btn-primary">
          Add player
        </button>
      </form>

      {roster.length > 0 ? (
        <ul className="card mt-5 p-2">
          {roster.map((player) => (
            <li
              key={player.id}
              className="flex min-h-14 items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
              style={{ borderColor: "var(--rule)" }}
            >
              <span className="min-w-0">
                <Link
                  href={`/players/${player.id}`}
                  className={`link ${player.is_active ? "" : "text-muted"}`}
                >
                  {player.full_name}
                </Link>
                <span className="text-muted block text-sm">
                  {[player.grade, player.is_active ? "Active" : "Retired"]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <form action={setPlayerActive}>
                <input type="hidden" name="playerId" value={player.id} />
                <input
                  type="hidden"
                  name="active"
                  value={player.is_active ? "false" : "true"}
                />
                <button type="submit" className="btn-quiet">
                  {player.is_active ? "Retire" : "Bring back"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <Note>
        Retiring a player stops them being paired but keeps their games, because
        those games count towards other players&rsquo; tiebreaks.
      </Note>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<SuggestionStatus, string> = {
  new: "New",
  planned: "Planned",
  done: "Done",
  declined: "Declined",
};

async function SuggestionsPanel() {
  const { suggestions, error } = await getSuggestions();
  if (error) {
    return (
      <ErrorNote>
        Suggestions could not be loaded ({error}). If this is a new install,
        run supabase/migrations/0008_suggestions.sql in the Supabase SQL editor.
      </ErrorNote>
    );
  }

  const counts = new Map<SuggestionStatus, number>();
  for (const suggestion of suggestions) {
    counts.set(suggestion.status, (counts.get(suggestion.status) ?? 0) + 1);
  }

  return (
    <section>
      <SectionHeading>Suggestions</SectionHeading>
      <p className="text-muted mt-2 max-w-prose leading-relaxed">
        Sent by visitors from the{" "}
        <Link href="/suggest" className="link">
          suggestion page
        </Link>
        , newest first. Only officers see these. Giving one a status takes it off
        the count on this tab.
      </p>

      {suggestions.length > 0 ? (
        <p className="mt-4 flex flex-wrap gap-2">
          {SUGGESTION_STATUSES.map((status) => (
            <span key={status} className="tag">
              {counts.get(status) ?? 0} {STATUS_LABELS[status].toLowerCase()}
            </span>
          ))}
        </p>
      ) : null}

      {suggestions.length === 0 ? (
        <EmptyState>No suggestions yet.</EmptyState>
      ) : (
        <ul className="mt-5 space-y-3">
          {suggestions.map((suggestion) => (
            <SuggestionItem key={suggestion.id} suggestion={suggestion} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SuggestionItem({ suggestion }: { suggestion: SuggestionRow }) {
  const settled = suggestion.status === "done" || suggestion.status === "declined";

  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium">
          {suggestion.name ?? <span className="text-muted font-normal">Anonymous</span>}
        </p>
        <p className="text-muted flex items-center gap-2 text-sm">
          <time dateTime={suggestion.created_at}>
            {formatSubmitted(suggestion.created_at)}
          </time>
          <span className={suggestion.status === "new" ? "tag tag-strong" : "tag"}>
            {STATUS_LABELS[suggestion.status]}
          </span>
        </p>
      </div>

      <p
        className={`mt-2 max-w-prose leading-relaxed break-words whitespace-pre-wrap ${
          settled ? "text-muted" : ""
        }`}
      >
        {suggestion.body}
      </p>

      <div
        className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4"
        style={{ borderColor: "var(--rule)" }}
      >
        <span className="label mr-1">Mark as</span>
        {SUGGESTION_STATUSES.map((status) => {
          const current = status === suggestion.status;
          return (
            <form key={status} action={setSuggestionStatus}>
              <input type="hidden" name="suggestionId" value={suggestion.id} />
              <input type="hidden" name="status" value={status} />
              <button
                type="submit"
                disabled={current}
                aria-pressed={current}
                className="btn-quiet"
              >
                {STATUS_LABELS[status]}
              </button>
            </form>
          );
        })}

        <form action={deleteSuggestion} className="ml-auto">
          <input type="hidden" name="suggestionId" value={suggestion.id} />
          <button type="submit" className="btn-quiet">
            Delete
          </button>
        </form>
      </div>
    </li>
  );
}

/** When a suggestion arrived, in the school's time zone. */
function formatSubmitted(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function SettingsPanel({ saved }: { saved: boolean }) {
  const current = await getDefaultWording();
  const placeholders = [
    ...CLUB_INFO.meetings.map((m) => m.value),
    ...CLUB_INFO.join,
    CLUB_INFO.contact,
  ].filter(isPlaceholder).length;

  return (
    <div className="space-y-10">
      <section>
        <SectionHeading>Wording for visitors</SectionHeading>
        <p className="text-muted mt-2 max-w-prose leading-relaxed">
          Choose what someone sees the first time they visit. Anyone can still
          switch for themselves with the &ldquo;Show&rdquo; buttons on the
          standings, results and player pages.
        </p>

        {saved ? (
          <p
            role="status"
            className="mt-4 flex items-center gap-2 rounded-lg border-2 px-4 py-3"
            style={{ borderColor: "var(--color-ink)" }}
          >
            <CheckIcon className="size-5" />
            Saved. New visitors will see this from now on.
          </p>
        ) : null}

        <form action={setDefaultWording} className="mt-5">
          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="sr-only">Default wording</legend>
            {[
              {
                value: "plain",
                title: "Everyday words",
                example: "Points · Opponents' strength · Free round · Maria won",
              },
              {
                value: "chess",
                title: "Chess terms",
                example: "Score · Buchholz · Bye · 1–0",
              },
            ].map((option) => (
              <label
                key={option.value}
                className="card-link flex cursor-pointer gap-3 p-4 has-[:checked]:border-2 has-[:checked]:border-[var(--color-ink)]"
              >
                <input
                  type="radio"
                  name="wording"
                  value={option.value}
                  defaultChecked={current === option.value}
                  className="mt-1 size-5 accent-[var(--color-ink)]"
                />
                <span>
                  <span className="block font-medium">{option.title}</span>
                  <span className="text-muted mt-0.5 block text-sm">{option.example}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <button type="submit" className="btn-primary mt-4">
            Save
          </button>
        </form>
      </section>

      <section>
        <SectionHeading>Club details</SectionHeading>
        <p className="text-muted mt-2 max-w-prose leading-relaxed">
          Meeting times, how to join and who to contact are shown on the{" "}
          <Link href="/about" className="link">
            About page
          </Link>
          . They are kept in the file{" "}
          <code className="rounded bg-cream-deep px-1.5 py-0.5 text-sm">src/lib/club/info.ts</code>{" "}
          and changed with the rest of the site&rsquo;s code.
        </p>
        <p className="mt-3">
          {placeholders === 0 ? (
            <span className="tag">All filled in</span>
          ) : (
            <span className="tag tag-strong">
              {placeholders} {placeholders === 1 ? "detail" : "details"} still to fill in
            </span>
          )}
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Officers & adviser
// ---------------------------------------------------------------------------

/**
 * Who holds each position, by school year, as shown on the public Players
 * page. Years are kept, so handing over means adding the new year rather than
 * overwriting the old one.
 */
async function OfficersPanel({ year }: { year: string | null }) {
  const [{ years, error }, roster] = await Promise.all([getOfficerYears(), getRoster()]);
  if (error) {
    return (
      <ErrorNote>
        The officers list could not be loaded ({error}). If this is a new
        install, run supabase/migrations/0010_club_officers.sql in the Supabase
        SQL editor.
      </ErrorNote>
    );
  }

  const now = new Date();
  const selected = year ?? years[0]?.schoolYear ?? schoolYearOf(now);
  const choices = schoolYearChoices(
    now,
    years.map((y) => y.schoolYear),
  );
  const entries = years.find((y) => y.schoolYear === selected)?.officers ?? [];
  const playerById = new Map(roster.map((p) => [p.id, p]));
  const players = [...roster].sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <section>
      <SectionHeading>Officers &amp; adviser</SectionHeading>
      <p className="text-muted mt-2 max-w-prose leading-relaxed">
        Shown to everyone on the{" "}
        <Link href="/players/officers" className="link">
          Players page
        </Link>
        . Each school year is kept, so past officers stay listed when a new
        year is added.
      </p>

      <nav aria-label="School year" className="mt-5">
        <p className="label">School year</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {choices.map((choice) => {
            const count = years.find((y) => y.schoolYear === choice)?.officers.length ?? 0;
            return (
              <li key={choice}>
                <Link
                  href={`/officer?tab=officers&year=${choice}`}
                  aria-current={choice === selected ? "page" : undefined}
                  className={choice === selected ? "btn-primary btn-sm" : "btn btn-sm"}
                >
                  {formatSchoolYear(choice)}
                  {count > 0 ? (
                    <span className="text-xs font-normal opacity-80">({count})</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <datalist id="position-suggestions">
        {SUGGESTED_POSITIONS.map((position) => (
          <option key={position} value={position} />
        ))}
      </datalist>

      <h3 className="mt-8 text-lg">{formatSchoolYear(selected)}</h3>
      {entries.length === 0 ? (
        <p className="card text-muted mt-3 p-5">
          Nobody is listed for {formatSchoolYear(selected)} yet. Add the adviser
          and officers below, in the order they should appear.
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {entries.map((officer, index) => {
            const player = officer.player_id ? playerById.get(officer.player_id) : undefined;
            return (
              <li key={officer.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-muted text-sm font-medium">{officer.position}</p>
                    <p className="font-medium">
                      {player ? player.full_name : officer.name}
                      {player ? (
                        <span className="text-muted ml-2 text-sm font-normal">
                          {[player.grade, "on the roster"].filter(Boolean).join(" · ")}
                        </span>
                      ) : null}
                    </p>
                    {officer.message ? (
                      <p className="text-muted mt-1 text-sm break-words">{officer.message}</p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <MoveButton officer={officer} direction="up" disabled={index === 0} />
                    <MoveButton
                      officer={officer}
                      direction="down"
                      disabled={index === entries.length - 1}
                    />
                    <form action={removeClubOfficer}>
                      <input type="hidden" name="officerId" value={officer.id} />
                      <input type="hidden" name="schoolYear" value={officer.school_year} />
                      <button type="submit" className="btn-quiet">
                        Remove
                      </button>
                    </form>
                  </div>
                </div>

                <details className="group mt-3">
                  <summary className="btn-quiet w-fit list-none">
                    <span className="group-open:hidden">Edit</span>
                    <span className="hidden group-open:inline">Close editing</span>
                  </summary>
                  <form
                    action={updateClubOfficer}
                    className="mt-3 border-t pt-4"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <input type="hidden" name="officerId" value={officer.id} />
                    <OfficerFields
                      idPrefix={`edit-${officer.id}`}
                      players={players}
                      choices={choices}
                      defaults={officer}
                    />
                    <button type="submit" className="btn-primary mt-4">
                      Save changes
                    </button>
                  </form>
                </details>
              </li>
            );
          })}
        </ol>
      )}

      <form action={addClubOfficer} className="card mt-6 p-5">
        <h3 className="text-lg">Add someone</h3>
        <p className="text-muted mt-1 text-sm leading-relaxed">
          Choose a player from the roster so their page and grade stay linked,
          or type a name for someone who is not on it, such as the adviser.
        </p>
        <div className="mt-4">
          <OfficerFields
            idPrefix="add"
            players={players}
            choices={choices}
            defaults={{ school_year: selected }}
          />
        </div>
        <button type="submit" className="btn-primary mt-4">
          Add to the list
        </button>
      </form>
    </section>
  );
}

function MoveButton({
  officer,
  direction,
  disabled,
}: {
  officer: ClubOfficerRow;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveClubOfficer}>
      <input type="hidden" name="officerId" value={officer.id} />
      <input type="hidden" name="schoolYear" value={officer.school_year} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        className="btn-quiet disabled:cursor-default disabled:opacity-40"
        aria-label={`Move ${officer.position} ${direction}`}
      >
        {direction === "up" ? "↑ Up" : "↓ Down"}
      </button>
    </form>
  );
}

/** The fields for one entry, shared by adding and editing. */
function OfficerFields({
  idPrefix,
  players,
  choices,
  defaults,
}: {
  idPrefix: string;
  players: PlayerRow[];
  choices: string[];
  defaults: Partial<ClubOfficerRow>;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="label block" htmlFor={`${idPrefix}-position`}>
          Position
        </label>
        <input
          id={`${idPrefix}-position`}
          name="position"
          required
          list="position-suggestions"
          maxLength={OFFICER_POSITION_MAX_LENGTH}
          defaultValue={defaults.position ?? ""}
          placeholder="President, Adviser…"
          className="field mt-1.5"
        />
      </div>
      <div>
        <label className="label block" htmlFor={`${idPrefix}-year`}>
          School year
        </label>
        <select
          id={`${idPrefix}-year`}
          name="schoolYear"
          defaultValue={defaults.school_year}
          className="field mt-1.5"
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {formatSchoolYear(choice)}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label block" htmlFor={`${idPrefix}-player`}>
          Player on the roster
        </label>
        <select
          id={`${idPrefix}-player`}
          name="playerId"
          defaultValue={defaults.player_id ?? ""}
          className="field mt-1.5"
        >
          <option value="">Not on the roster</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.full_name}
              {player.grade ? ` (${player.grade})` : ""}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label block" htmlFor={`${idPrefix}-name`}>
          Or their name, if not on the roster
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          maxLength={OFFICER_NAME_MAX_LENGTH}
          defaultValue={defaults.name ?? ""}
          placeholder="e.g. Ms. Dela Cruz"
          className="field mt-1.5"
        />
      </div>
      <div className="sm:col-span-2">
        <label className="label block" htmlFor={`${idPrefix}-message`}>
          Message or contact <span className="font-normal">(optional)</span>
        </label>
        <input
          id={`${idPrefix}-message`}
          name="message"
          maxLength={OFFICER_MESSAGE_MAX_LENGTH}
          defaultValue={defaults.message ?? ""}
          placeholder="Ask me about joining"
          className="field mt-1.5"
        />
        <p className="text-muted mt-1.5 text-sm">
          Everyone can see this. Only share contact details the person is happy
          to have public.
        </p>
      </div>
    </div>
  );
}
