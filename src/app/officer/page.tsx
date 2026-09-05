import type { Metadata } from "next";
import Link from "next/link";
import { formatMatchupScore } from "@/components/matchup-games";
import { Pawn } from "@/components/pawn";
import { SiteHeader } from "@/components/site-header";
import {
  addManualMatchup,
  addPlayer,
  clearPairings,
  completeRound,
  createSeason,
  deleteMatchup,
  generatePairings,
  setPlayerActive,
  startRound,
  unlockRole,
} from "@/lib/club/actions";
import {
  getActiveSeason,
  getRoster,
  getRoundMatchups,
  getSeasonHistory,
  type MatchupView,
} from "@/lib/club/queries";
import { currentRole } from "@/lib/officer/session";
import type { PlayerRow } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Officers" };

export default async function OfficerPage({ searchParams }: PageProps<"/officer">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const role = await currentRole();

  if (role !== "officer") {
    return (
      <>
        <SiteHeader role={role} currentPath="/officer" />
        <PasscodeGate error={error} />
      </>
    );
  }

  const season = await getActiveSeason();

  return (
    <>
      <SiteHeader role={role} currentPath="/officer" />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="label">Officers</p>
        <h1 className="mt-3 text-4xl">Run a round</h1>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {season ? (
          <SeasonPanel seasonId={season.id} seasonName={season.name} />
        ) : (
          <NewSeasonForm />
        )}

        <RosterSection />
      </main>
    </>
  );
}

function PasscodeGate({ error }: { error: string | null }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <Pawn className="mb-8 h-8 w-auto" />
      <h1 className="text-3xl">Club tools</h1>
      <p className="text-muted mt-3 text-sm leading-relaxed">
        Officers run rounds and manage the roster. Arbiters report results in the
        open round. Standings and results are open to everyone and need nothing.
      </p>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <form action={unlockRole} className="mt-8">
        <label className="label block" htmlFor="passcode">
          Passcode
        </label>
        <input
          id="passcode"
          name="passcode"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full border bg-transparent px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--rule-strong)" }}
        />
        <button
          type="submit"
          className="mt-4 w-full cursor-pointer border px-5 py-2.5 text-sm transition-colors hover:bg-ink hover:text-cream"
          style={{ borderColor: "var(--color-ink)" }}
        >
          Unlock
        </button>
      </form>
    </main>
  );
}

function NewSeasonForm() {
  return (
    <section className="mt-10">
      <p className="text-muted max-w-prose text-sm leading-relaxed">
        No season is running. Start one to begin pairing rounds — a season is one
        continuous Swiss event, so you only need a new one at the start of a term
        or year.
      </p>
      <form action={createSeason} className="mt-6 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="season-name">
          Season name
        </label>
        <input
          id="season-name"
          name="name"
          required
          placeholder="Spring 2026"
          className="border bg-transparent px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--rule-strong)" }}
        />
        <SubmitButton>Start season</SubmitButton>
      </form>
    </section>
  );
}

async function SeasonPanel({
  seasonId,
  seasonName,
}: {
  seasonId: string;
  seasonName: string;
}) {
  const [roster, history] = await Promise.all([
    getRoster(),
    getSeasonHistory(seasonId),
  ]);

  const currentRound = history.rounds.at(-1) ?? null;
  const matchups = currentRound ? await getRoundMatchups(currentRound.id) : [];
  const active = roster.filter((p) => p.is_active);
  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));

  const outstanding = matchups.reduce(
    (sum, view) => sum + view.games.filter((g) => g.result === "pending").length,
    0,
  );

  return (
    <>
      <p className="text-muted mt-4 text-sm">
        {seasonName} · {history.rounds.length}{" "}
        {history.rounds.length === 1 ? "round" : "rounds"} so far
      </p>

      {!currentRound || currentRound.status === "completed" ? (
        <form action={startRound} className="mt-8 flex flex-wrap items-end gap-3">
          <div>
            <label className="label block" htmlFor="played-on">
              Date played
            </label>
            <input
              id="played-on"
              name="playedOn"
              type="date"
              className="mt-2 border bg-transparent px-3 py-2 text-sm"
              style={{ borderColor: "var(--rule-strong)" }}
            />
          </div>
          <SubmitButton>
            Start round {(currentRound?.round_number ?? 0) + 1}
          </SubmitButton>
        </form>
      ) : null}

      {currentRound ? (
        <Section
          title={`Round ${currentRound.round_number} · matchups`}
          note={`${active.length} active players`}
        >
          {matchups.length === 0 ? (
            <>
              <Note>
                Every active player is paired into a matchup of three games. With
                an odd number one bye is given automatically.
              </Note>
              <form action={generatePairings} className="mt-5">
                <input type="hidden" name="roundId" value={currentRound.id} />
                <SubmitButton>Generate matchups</SubmitButton>
              </form>
            </>
          ) : (
            <MatchupList
              matchups={matchups}
              nameById={nameById}
              roundId={currentRound.id}
              roundStatus={currentRound.status}
              outstanding={outstanding}
            />
          )}

          {currentRound.status !== "completed" ? (
            <ManualMatchupForm roundId={currentRound.id} players={active} />
          ) : null}
        </Section>
      ) : null}
    </>
  );
}

function MatchupList({
  matchups,
  nameById,
  roundId,
  roundStatus,
  outstanding,
}: {
  matchups: MatchupView[];
  nameById: ReadonlyMap<string, string>;
  roundId: string;
  roundStatus: string;
  outstanding: number;
}) {
  const rematches = matchups.filter((v) => v.pairing.is_rematch).length;

  return (
    <>
      {rematches > 0 ? (
        <Note>
          {rematches === 1 ? "One matchup repeats" : `${rematches} matchups repeat`}{" "}
          an earlier meeting. That only happens when no other pairing of this round
          was possible.
        </Note>
      ) : null}

      <ul className="mt-5">
        {matchups.map((view) => {
          const isBye = view.pairing.player_b_id === null;
          const left = view.games.filter((g) => g.result === "pending").length;

          return (
            <li
              key={view.pairing.id}
              className="flex items-center gap-3 border-b"
              style={{ borderColor: "var(--rule)" }}
            >
              <Link
                href={`/matchup/${view.pairing.id}`}
                className="flex min-w-0 flex-1 items-center gap-4 py-3 text-sm transition-colors hover:bg-cream-deep"
              >
                <span className="text-faint w-6" data-numeric>
                  {view.pairing.board_number}
                </span>
                <span className="min-w-0 flex-1">
                  {nameById.get(view.pairing.player_a_id)}
                  {isBye ? (
                    <span className="text-faint"> — bye</span>
                  ) : (
                    <>
                      <span className="text-faint mx-2">v</span>
                      {nameById.get(view.pairing.player_b_id!)}
                    </>
                  )}
                  {view.pairing.is_rematch ? (
                    <span className="text-faint ml-2 text-xs">repeat</span>
                  ) : null}
                </span>
                <span className="tabular-nums whitespace-nowrap">
                  {isBye ? (
                    <span className="text-faint text-xs">—</span>
                  ) : (
                    formatMatchupScore(view)
                  )}
                </span>
                <span className="text-faint w-20 text-right text-xs">
                  {isBye ? "" : left === 0 ? "complete" : `${left} to go`}
                </span>
              </Link>

              {roundStatus !== "completed" ? (
                <form action={deleteMatchup}>
                  <input type="hidden" name="pairingId" value={view.pairing.id} />
                  <button
                    type="submit"
                    aria-label={`Remove board ${view.pairing.board_number}`}
                    className="text-faint cursor-pointer text-xs transition-colors hover:text-ink"
                  >
                    Remove
                  </button>
                </form>
              ) : null}
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        {roundStatus !== "completed" && outstanding === 0 ? (
          <form action={completeRound}>
            <input type="hidden" name="roundId" value={roundId} />
            <SubmitButton>Close round</SubmitButton>
          </form>
        ) : null}

        {roundStatus !== "completed" && outstanding > 0 ? (
          <form action={completeRound}>
            <input type="hidden" name="roundId" value={roundId} />
            <input type="hidden" name="forfeitUnplayed" value="true" />
            <SubmitButton>
              Close round, forfeiting {outstanding}{" "}
              {outstanding === 1 ? "game" : "games"}
            </SubmitButton>
          </form>
        ) : null}

        {roundStatus !== "completed" ? (
          <form action={clearPairings}>
            <input type="hidden" name="roundId" value={roundId} />
            <button
              type="submit"
              className="text-faint cursor-pointer border px-4 py-2 text-sm transition-colors hover:text-ink"
              style={{ borderColor: "var(--rule-strong)" }}
            >
              Clear and re-pair
            </button>
          </form>
        ) : null}

        {outstanding > 0 ? (
          <p className="text-faint self-center text-sm">
            {outstanding} {outstanding === 1 ? "game" : "games"} still to report
          </p>
        ) : null}
      </div>
    </>
  );
}

/**
 * Add a matchup by hand.
 *
 * How a club catches up: meetings played before the site existed go in round by
 * round, then each matchup's games are filled in from its own page.
 */
function ManualMatchupForm({
  roundId,
  players,
}: {
  roundId: string;
  players: PlayerRow[];
}) {
  return (
    <div className="mt-10 border-t pt-6" style={{ borderColor: "var(--rule)" }}>
      <h3 className="label">Add a matchup by hand</h3>
      <p className="text-faint mt-2 max-w-prose text-xs leading-relaxed">
        For meetings played before the club used this site. Add the matchup, then
        open it to enter its three games.
      </p>

      <form
        action={addManualMatchup}
        className="mt-4 flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="roundId" value={roundId} />

        <SelectField label="Player" name="playerAId" id="player-a" required>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.full_name}
            </option>
          ))}
        </SelectField>

        <SelectField label="Opponent" name="playerBId" id="player-b">
          <option value="bye">No opponent (bye)</option>
          {players.map((player) => (
            <option key={player.id} value={player.id}>
              {player.full_name}
            </option>
          ))}
        </SelectField>

        <SubmitButton>Add matchup</SubmitButton>
      </form>
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
    <div>
      <label className="label block" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        defaultValue=""
        className="mt-2 border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: "var(--rule-strong)" }}
      >
        <option value="" disabled>
          Choose
        </option>
        {children}
      </select>
    </div>
  );
}

async function RosterSection() {
  const roster = await getRoster();
  const active = roster.filter((p) => p.is_active).length;

  return (
    <Section title="Roster" note={`${active} active`}>
      <form action={addPlayer} className="mt-4 flex flex-wrap items-center gap-3">
        <label className="sr-only" htmlFor="player-name">
          Player name
        </label>
        <input
          id="player-name"
          name="fullName"
          required
          placeholder="Add a player by name"
          className="border bg-transparent px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--rule-strong)" }}
        />
        <SubmitButton>Add</SubmitButton>
      </form>

      {roster.length > 0 ? (
        <ul className="mt-6 grid gap-x-8 gap-y-1 sm:grid-cols-2">
          {roster.map((player) => (
            <li
              key={player.id}
              className="flex items-center justify-between border-b py-2"
              style={{ borderColor: "var(--rule)" }}
            >
              <span className={player.is_active ? "text-sm" : "text-faint text-sm"}>
                {player.full_name}
                {!player.is_active ? (
                  <span className="text-faint ml-2 text-xs">retired</span>
                ) : null}
              </span>
              <form action={setPlayerActive}>
                <input type="hidden" name="playerId" value={player.id} />
                <input
                  type="hidden"
                  name="active"
                  value={player.is_active ? "false" : "true"}
                />
                <button
                  type="submit"
                  className="text-faint cursor-pointer text-xs transition-colors hover:text-ink"
                >
                  {player.is_active ? "Retire" : "Reinstate"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-faint mt-4 max-w-prose text-xs leading-relaxed">
        Retiring a player hides them from future rounds but keeps their games,
        because those games are part of other players&rsquo; tiebreaks. Names appear
        on the public standings page, so use whatever form the club is comfortable
        publishing.
      </p>
    </Section>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl">{title}</h2>
        {note ? <span className="text-faint text-xs">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 flex items-start gap-3">
      <Pawn className="text-faint mt-0.5 h-4 w-auto shrink-0" />
      <p className="text-muted max-w-prose text-sm leading-relaxed">{children}</p>
    </div>
  );
}

function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="mt-6 border-l-2 py-1 pl-4 text-sm"
      style={{ borderColor: "var(--color-ink)" }}
    >
      {children}
    </p>
  );
}

function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="cursor-pointer border px-5 py-2.5 text-sm transition-colors hover:bg-ink hover:text-cream"
      style={{ borderColor: "var(--color-ink)" }}
    >
      {children}
    </button>
  );
}
