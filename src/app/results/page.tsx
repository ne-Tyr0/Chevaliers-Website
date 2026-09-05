import type { Metadata } from "next";
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
} from "@/lib/club/queries";
import { isOfficer } from "@/lib/officer/session";
import { computeStandings, gameRecordsByPlayer } from "@/lib/swiss";
import type { GameRecord, StandingRow } from "@/lib/swiss";
import type { PairingRow } from "@/lib/supabase/database.types";

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
  a_forfeit_win: "White won by default",
  b_forfeit_win: "Black won by default",
  double_forfeit: "Neither player appeared",
};

export default async function ResultsPage() {
  const [officer, season] = await Promise.all([isOfficer(), getActiveSeason()]);

  if (!season) {
    return (
      <>
        <SiteHeader isOfficer={officer} currentPath="/results" />
        <main className="mx-auto max-w-5xl px-6 py-20">
          <h1 className="text-4xl">Pairings &amp; results</h1>
          <Empty>
            No season is running yet. Once an officer starts one and pairs the
            first round, every board appears here.
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
  const gamesByPlayer = gameRecordsByPlayer(history.completed);
  const standings = computeStandings(
    toPlayerInputs(seasonParticipants(roster, history.allPairings)),
    history.completed,
  );
  const rowById = new Map(standings.map((row) => [row.playerId, row]));

  // Newest round first: the last meeting is the one people came to look at.
  const rounds = history.rounds
    .slice()
    .sort((a, b) => b.round_number - a.round_number)
    .map((round) => ({
      round,
      boards: history.allPairings
        .filter((p) => p.round_id === round.id)
        .sort((a, b) => a.board_number - b.board_number),
    }))
    .filter((entry) => entry.boards.length > 0);

  return (
    <>
      <SiteHeader isOfficer={officer} currentPath="/results" />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="label">{season.name}</p>
        <h1 className="mt-3 text-4xl">Pairings &amp; results</h1>
        <p className="text-muted mt-3 text-sm">
          Every board of the season, most recent first. Hover or tap a name for
          that player&rsquo;s record.
        </p>

        {rounds.length === 0 ? (
          <Empty>
            No rounds have been paired yet. They appear here as soon as an officer
            generates the first one.
          </Empty>
        ) : (
          <div className="mt-12 space-y-12">
            {rounds.map(({ round, boards }) => (
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
                  {boards.map((board) => (
                    <Board
                      key={board.id}
                      board={board}
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

function Board({
  board,
  nameById,
  rowById,
  gamesByPlayer,
}: {
  board: PairingRow;
  nameById: ReadonlyMap<string, string>;
  rowById: ReadonlyMap<string, StandingRow>;
  gamesByPlayer: ReadonlyMap<string, GameRecord[]>;
}) {
  const isBye = board.player_b_id === null;

  return (
    <li
      className="grid grid-cols-[2rem_1fr_auto_1fr] items-center gap-3 border-b py-3 text-sm"
      style={{ borderColor: "var(--rule)" }}
    >
      <span className="text-faint" data-numeric>
        {board.board_number}
      </span>

      <span className="min-w-0">
        <Name
          id={board.player_a_id}
          nameById={nameById}
          rowById={rowById}
          gamesByPlayer={gamesByPlayer}
        />
      </span>

      <span
        className="text-center tabular-nums whitespace-nowrap"
        title={isBye ? "Bye, worth one point" : RESULT_HINT[board.result]}
      >
        {isBye ? (
          <span className="text-muted text-xs">bye</span>
        ) : (
          <span className={board.result === "pending" ? "text-faint" : ""}>
            {RESULT_LABEL[board.result] ?? board.result}
          </span>
        )}
      </span>

      <span className="min-w-0">
        {isBye ? (
          <span className="text-faint text-xs">—</span>
        ) : (
          <Name
            id={board.player_b_id!}
            nameById={nameById}
            rowById={rowById}
            gamesByPlayer={gamesByPlayer}
          />
        )}
      </span>
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
