import type { Metadata } from "next";
import { formatMatchupScore } from "@/components/matchup-games";
import { Pawn } from "@/components/pawn";
import { PlayerCard } from "@/components/player-card";
import { SiteHeader } from "@/components/site-header";
import { StatPopover } from "@/components/stat-popover";
import {
  getActiveSeason,
  getRoster,
  getSeasonHistory,
  seasonParticipants,
  toPlayerInputs,
  type MatchupView,
} from "@/lib/club/queries";
import { currentRole } from "@/lib/officer/session";
import { computeStandings, playerHistory } from "@/lib/swiss";
import type { GameRecord, StandingRow } from "@/lib/swiss";

export const metadata: Metadata = { title: "Pairings & results" };

/** Scores as they are written on a pairing sheet. */
const RESULT_LABEL: Record<string, string> = {
  pending: "·",
  a_win: "1 – 0",
  b_win: "0 – 1",
  draw: "½ – ½",
  a_forfeit_win: "+ –",
  b_forfeit_win: "– +",
  double_forfeit: "– –",
};

const RESULT_HINT: Record<string, string> = {
  pending: "Not yet reported",
  a_win: "White won",
  b_win: "Black won",
  draw: "Draw",
  a_forfeit_win: "Won by default",
  b_forfeit_win: "Lost by default",
  double_forfeit: "Neither player appeared",
};

export default async function ResultsPage() {
  const [role, season] = await Promise.all([currentRole(), getActiveSeason()]);

  if (!season) {
    return (
      <>
        <SiteHeader role={role} currentPath="/results" />
        <main className="mx-auto max-w-5xl px-6 py-20">
          <h1 className="text-4xl">Pairings &amp; results</h1>
          <Empty>
            No season is running yet. Once an officer starts one and pairs the
            first round, every matchup appears here.
          </Empty>
        </main>
      </>
    );
  }

  const [roster, history] = await Promise.all([
    getRoster(),
    getSeasonHistory(season.id),
  ]);

  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const byPlayer = playerHistory(history.matchups);
  const gamesByPlayer = new Map([...byPlayer].map(([id, e]) => [id, e.games]));
  const standings = computeStandings(
    toPlayerInputs(seasonParticipants(roster, history.matchupViews)),
    history.matchups,
  );
  const rowById = new Map(standings.map((row) => [row.playerId, row]));

  // Newest round first: the last meeting is the one people came to look at.
  const rounds = history.rounds
    .slice()
    .sort((a, b) => b.round_number - a.round_number)
    .map((round) => ({
      round,
      matchups: history.matchupViews.filter((v) => v.pairing.round_id === round.id),
    }))
    .filter((entry) => entry.matchups.length > 0);

  return (
    <>
      <SiteHeader role={role} currentPath="/results" />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="label">{season.name}</p>
        <h1 className="mt-3 text-4xl">Pairings &amp; results</h1>
        <p className="text-muted mt-3 text-sm">
          Every matchup of the season, most recent first. Each is three games, so
          the score shown is the matchup total. Open one to see the games, or
          hover a name for that player&rsquo;s record.
        </p>

        {rounds.length === 0 ? (
          <Empty>
            No rounds have been paired yet. They appear here as soon as an officer
            generates the first one.
          </Empty>
        ) : (
          <div className="mt-12 space-y-12">
            {rounds.map(({ round, matchups }) => (
              <section key={round.id}>
                <div
                  className="flex items-baseline justify-between gap-4 border-b pb-2"
                  style={{ borderColor: "var(--rule-strong)" }}
                >
                  <h2 className="text-xl">Round {round.round_number}</h2>
                  <span className="text-faint text-xs">
                    {formatDate(round.played_on)}
                    {round.status !== "completed" ? " · in progress" : ""}
                  </span>
                </div>

                <ul>
                  {matchups.map((view) => (
                    <Matchup
                      key={view.pairing.id}
                      view={view}
                      nameById={nameById}
                      rowById={rowById}
                      gamesByPlayer={gamesByPlayer}
                    />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function Matchup({
  view,
  nameById,
  rowById,
  gamesByPlayer,
}: {
  view: MatchupView;
  nameById: ReadonlyMap<string, string>;
  rowById: ReadonlyMap<string, StandingRow>;
  gamesByPlayer: ReadonlyMap<string, GameRecord[]>;
}) {
  const isBye = view.pairing.player_b_id === null;
  const nameA = nameById.get(view.pairing.player_a_id) ?? "Unknown player";
  const nameB = view.pairing.player_b_id
    ? (nameById.get(view.pairing.player_b_id) ?? "Unknown player")
    : null;

  const header = (
    <div className="grid grid-cols-[2rem_1fr_auto_1fr] items-center gap-3 text-sm">
      <span className="text-faint" data-numeric>
        {view.pairing.board_number}
      </span>
      <span className="min-w-0">
        <Name
          id={view.pairing.player_a_id}
          nameById={nameById}
          rowById={rowById}
          gamesByPlayer={gamesByPlayer}
        />
      </span>
      <span className="text-center tabular-nums whitespace-nowrap">
        {isBye ? (
          <span className="text-muted text-xs">bye</span>
        ) : (
          formatMatchupScore(view)
        )}
      </span>
      <span className="min-w-0">
        {isBye ? (
          <span className="text-faint text-xs">—</span>
        ) : (
          <Name
            id={view.pairing.player_b_id!}
            nameById={nameById}
            rowById={rowById}
            gamesByPlayer={gamesByPlayer}
          />
        )}
      </span>
    </div>
  );

  if (isBye || view.games.length === 0) {
    return (
      <li className="border-b py-3" style={{ borderColor: "var(--rule)" }}>
        {header}
      </li>
    );
  }

  return (
    <li className="border-b" style={{ borderColor: "var(--rule)" }}>
      <details className="group">
        <summary className="cursor-pointer list-none py-3">
          {header}
          <span className="text-faint mt-1 block pl-11 text-xs group-open:hidden">
            Show games
          </span>
        </summary>

        <ul
          className="mb-3 ml-11 border-l pl-4"
          style={{ borderColor: "var(--rule)" }}
        >
          {view.games.map((game) => (
            <li
              key={game.id}
              className="flex items-center gap-3 py-1.5 text-xs"
              title={RESULT_HINT[game.result]}
            >
              <span className="text-faint w-14">Game {game.game_number}</span>
              <span className="text-muted min-w-0 flex-1 truncate">
                {game.color_a === "white"
                  ? `${nameA} as White`
                  : game.color_a === "black"
                    ? `${nameB} as White`
                    : "Colours not recorded"}
              </span>
              <span
                className={
                  game.result === "pending" ? "text-faint tabular-nums" : "tabular-nums"
                }
              >
                {RESULT_LABEL[game.result] ?? game.result}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </li>
  );
}

function Name({
  id,
  nameById,
  rowById,
  gamesByPlayer,
}: {
  id: string;
  nameById: ReadonlyMap<string, string>;
  rowById: ReadonlyMap<string, StandingRow>;
  gamesByPlayer: ReadonlyMap<string, GameRecord[]>;
}) {
  const name = nameById.get(id) ?? "Unknown player";
  const row = rowById.get(id);
  if (!row) return <span>{name}</span>;

  return (
    <StatPopover label={name} className="truncate">
      <PlayerCard
        name={name}
        row={row}
        games={gamesByPlayer.get(id) ?? []}
        nameById={nameById}
      />
    </StatPopover>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-10 flex items-start gap-4 border-t pt-8"
      style={{ borderColor: "var(--rule)" }}
    >
      <Pawn className="text-faint mt-0.5 h-5 w-auto shrink-0" />
      <p className="text-muted max-w-prose text-sm leading-relaxed">{children}</p>
    </div>
  );
}
