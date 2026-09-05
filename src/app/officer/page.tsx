import type { Metadata } from "next";
import { Pawn } from "@/components/pawn";
import { SiteHeader } from "@/components/site-header";
import {
  addPlayer,
  clearPairings,
  completeRound,
  createSeason,
  generatePairings,
  recordResult,
  setCheckIn,
  setPlayerActive,
  startRound,
  unlockOfficer,
} from "@/lib/club/actions";
import {
  getActiveSeason,
  getCheckedInIds,
  getRoster,
  getRoundPairings,
  getSeasonHistory,
} from "@/lib/club/queries";
import { isOfficer } from "@/lib/officer/session";
import type { PairingRow, PlayerRow } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Officers" };

export default async function OfficerPage({ searchParams }: PageProps<"/officer">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const officer = await isOfficer();

  if (!officer) {
    return (
      <>
        <SiteHeader isOfficer={false} currentPath="/officer" />
        <PasscodeGate error={error} />
      </>
    );
  }

  const season = await getActiveSeason();

  return (
    <>
      <SiteHeader isOfficer currentPath="/officer" />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="label">Officers</p>
        <h1 className="mt-3 text-4xl">Run a round</h1>

        {error ? <ErrorNote>{error}</ErrorNote> : null}

        {season ? (
          <SeasonPanel seasonId={season.id} seasonName={season.name} />
        ) : (
          <NewSeasonForm />
        )}
      </main>
    </>
  );
}

function PasscodeGate({ error }: { error: string | null }) {
  return (
    <main className="mx-auto max-w-md px-6 py-24">
      <Pawn className="mb-8 h-8 w-auto" />
      <h1 className="text-3xl">Officer tools</h1>
      <p className="text-muted mt-3 text-sm leading-relaxed">
        Running rounds and entering results needs the club passcode. Standings are
        open to everyone and need nothing.
      </p>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <form action={unlockOfficer} className="mt-8">
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
  const [pairings, checkedInIds] = currentRound
    ? await Promise.all([
        getRoundPairings(currentRound.id),
        getCheckedInIds(currentRound.id),
      ])
    : [[], []];

  const checkedIn = new Set(checkedInIds);
  const active = roster.filter((p) => p.is_active);

  return (
    <>
      <p className="text-muted mt-4 text-sm">
        {seasonName} · {history.rounds.length}{" "}
        {history.rounds.length === 1 ? "round" : "rounds"} so far
      </p>

      {!currentRound || currentRound.status === "completed" ? (
        <form action={startRound} className="mt-8">
          <SubmitButton>
            Start round {(currentRound?.round_number ?? 0) + 1}
          </SubmitButton>
        </form>
      ) : null}

      {currentRound ? (
        <>
          <Section
            title={`Round ${currentRound.round_number} · who is here`}
            note={`${checkedIn.size} of ${active.length} checked in`}
          >
            {active.length === 0 ? (
              <Note>
                The roster is empty. Add players below, then check in whoever turned
                up.
              </Note>
            ) : (
              <ul className="mt-4 grid gap-x-8 gap-y-1 sm:grid-cols-2">
                {active.map((player) => (
                  <CheckInRow
                    key={player.id}
                    player={player}
                    roundId={currentRound.id}
                    present={checkedIn.has(player.id)}
                    locked={pairings.length > 0}
                  />
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Round ${currentRound.round_number} · boards`}>
            {pairings.length === 0 ? (
              <>
                <Note>
                  Check in everyone who turned up, then generate the pairings. With
                  an odd number of players one bye is given automatically.
                </Note>
                <form action={generatePairings} className="mt-5">
                  <input type="hidden" name="roundId" value={currentRound.id} />
                  <SubmitButton>Generate pairings</SubmitButton>
                </form>
              </>
            ) : (
              <PairingList
                pairings={pairings}
                roster={roster}
                roundId={currentRound.id}
                roundStatus={currentRound.status}
              />
            )}
          </Section>
        </>
      ) : null}

      <RosterSection roster={roster} />
    </>
  );
}

function RosterSection({ roster }: { roster: PlayerRow[] }) {
  const retired = roster.filter((p) => !p.is_active);

  return (
    <Section title="Roster" note={`${roster.length - retired.length} active`}>
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
        Retiring a player hides them from check-in but keeps their games, because
        those games are part of other players&rsquo; tiebreaks. Names appear on the
        public standings page, so use whatever form the club is comfortable
        publishing.
      </p>
    </Section>
  );
}

function CheckInRow({
  player,
  roundId,
  present,
  locked,
}: {
  player: PlayerRow;
  roundId: string;
  present: boolean;
  locked: boolean;
}) {
  return (
    <li
      className="flex items-center justify-between border-b py-2"
      style={{ borderColor: "var(--rule)" }}
    >
      <span className={present ? "text-sm" : "text-faint text-sm"}>
        {player.full_name}
      </span>

      {locked ? (
        <span className="text-faint text-xs">{present ? "playing" : "away"}</span>
      ) : (
        <form action={setCheckIn}>
          <input type="hidden" name="roundId" value={roundId} />
          <input type="hidden" name="playerId" value={player.id} />
          <input type="hidden" name="present" value={present ? "false" : "true"} />
          <button
            type="submit"
            className="cursor-pointer border px-2.5 py-1 text-xs transition-colors hover:bg-ink hover:text-cream"
            style={{
              borderColor: present ? "var(--color-ink)" : "var(--rule-strong)",
            }}
          >
            {present ? "Here" : "Mark here"}
          </button>
        </form>
      )}
    </li>
  );
}

function PairingList({
  pairings,
  roster,
  roundId,
  roundStatus,
}: {
  pairings: PairingRow[];
  roster: PlayerRow[];
  roundId: string;
  roundStatus: string;
}) {
  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const outstanding = pairings.filter((p) => p.result === "pending").length;
  const rematches = pairings.filter((p) => p.is_rematch).length;

  return (
    <>
      {rematches > 0 ? (
        <Note>
          {rematches === 1 ? "One board repeats" : `${rematches} boards repeat`} an
          earlier match-up. That only happens when no other pairing of this round
          was possible — everyone left has already played everyone else they could
          face.
        </Note>
      ) : null}

      <ul className="mt-5">
        {pairings.map((pairing) => (
          <li
            key={pairing.id}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b py-3"
            style={{ borderColor: "var(--rule)" }}
          >
            <span className="text-faint w-6 text-sm" data-numeric>
              {pairing.board_number}
            </span>

            {pairing.player_b_id === null ? (
              <span className="text-muted text-sm">
                {nameById.get(pairing.player_a_id)} — bye, 1 point
              </span>
            ) : (
              <>
                <span className="min-w-0 flex-1 text-sm">
                  <Player
                    name={nameById.get(pairing.player_a_id)}
                    color={pairing.color_a}
                  />
                  <span className="text-faint mx-2">v</span>
                  <Player
                    name={nameById.get(pairing.player_b_id)}
                    color={pairing.color_b}
                  />
                  {pairing.is_rematch ? (
                    <span className="text-faint ml-2 text-xs">repeat</span>
                  ) : null}
                </span>

                <ResultPicker pairingId={pairing.id} result={pairing.result} />
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap gap-3">
        {roundStatus !== "completed" && outstanding === 0 ? (
          <form action={completeRound}>
            <input type="hidden" name="roundId" value={roundId} />
            <SubmitButton>Close round</SubmitButton>
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
            {outstanding} {outstanding === 1 ? "board" : "boards"} still to report
          </p>
        ) : null}
      </div>
    </>
  );
}

function Player({ name, color }: { name?: string; color: string | null }) {
  return (
    <span>
      {name ?? "Unknown"}
      {color ? (
        <span className="text-faint ml-1 text-xs">
          ({color === "white" ? "W" : "B"})
        </span>
      ) : null}
    </span>
  );
}

function ResultPicker({ pairingId, result }: { pairingId: string; result: string }) {
  const options = [
    { value: "a_win", label: "1–0" },
    { value: "draw", label: "½–½" },
    { value: "b_win", label: "0–1" },
  ];

  return (
    <div className="flex gap-1.5">
      {options.map((option) => {
        const selected = result === option.value;
        return (
          <form action={recordResult} key={option.value}>
            <input type="hidden" name="pairingId" value={pairingId} />
            <input
              type="hidden"
              name="result"
              value={selected ? "pending" : option.value}
            />
            <button
              type="submit"
              aria-pressed={selected}
              className="cursor-pointer border px-2.5 py-1 text-xs transition-colors hover:bg-ink hover:text-cream"
              style={
                selected
                  ? {
                      borderColor: "var(--color-ink)",
                      backgroundColor: "var(--color-ink)",
                      color: "var(--color-cream)",
                    }
                  : { borderColor: "var(--rule-strong)" }
              }
            >
              {option.label}
            </button>
          </form>
        );
      })}
    </div>
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
