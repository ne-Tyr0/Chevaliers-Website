import type { GameRecord, StandingRow } from "@/lib/swiss";
import { formatPoints, PlayerCard } from "./player-card";
import { StatPopover } from "./stat-popover";

export { formatPoints };

export function StandingsTable({
  rows,
  nameById,
  gamesByPlayer,
  highlightId,
}: {
  rows: readonly StandingRow[];
  nameById: ReadonlyMap<string, string>;
  /** Per-player history, used to fill the hover card. */
  gamesByPlayer: ReadonlyMap<string, GameRecord[]>;
  /** A row to tint, so a reader can find themselves. */
  highlightId?: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--rule-strong)" }}>
            <Th className="pr-3 text-left">#</Th>
            <Th className="pr-6 text-left">Player</Th>
            <Th className="pr-6 text-right" numeric>
              Score
            </Th>
            <Th className="pr-6 text-right" numeric>
              Played
            </Th>
            <Th className="pr-6 text-right" numeric>
              W–D–L
            </Th>
            <Th
              className="pr-6 text-right"
              numeric
              title="Buchholz — sum of opponents' scores"
            >
              Buch.
            </Th>
            <Th
              className="text-right"
              numeric
              title="Sonneborn-Berger — defeated opponents' scores, plus half of each drawn opponent's"
            >
              S–B
            </Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.playerId}
              className="border-b"
              style={{
                borderColor: "var(--rule)",
                backgroundColor:
                  row.playerId === highlightId
                    ? "var(--color-cream-deep)"
                    : undefined,
              }}
            >
              <td className="text-faint py-3 pr-3" data-numeric>
                {row.rank}
              </td>
              <td className="py-3 pr-6">
                <StatPopover
                  label={nameById.get(row.playerId) ?? "Unknown player"}
                >
                  <PlayerCard
                    name={nameById.get(row.playerId) ?? "Unknown player"}
                    row={row}
                    games={gamesByPlayer.get(row.playerId) ?? []}
                    nameById={nameById}
                  />
                </StatPopover>
                {row.byes > 0 ? (
                  <span className="text-faint ml-2 text-xs">
                    {row.byes === 1 ? "bye" : `${row.byes} byes`}
                  </span>
                ) : null}
                {row.forfeitWins + row.forfeitLosses > 0 ? (
                  <span
                    className="text-faint ml-2 text-xs"
                    title="Games decided without play"
                  >
                    {row.forfeitWins + row.forfeitLosses} def.
                  </span>
                ) : null}
              </td>
              <td className="py-3 pr-6 text-right font-medium" data-numeric>
                {formatPoints(row.score)}
              </td>
              <td className="text-muted py-3 pr-6 text-right" data-numeric>
                {row.gamesPlayed}
              </td>
              <td className="text-muted py-3 pr-6 text-right" data-numeric>
                {row.wins}–{row.draws}–{row.losses}
              </td>
              <td className="text-faint py-3 pr-6 text-right" data-numeric>
                {formatPoints(row.buchholz)}
              </td>
              <td className="text-faint py-3 text-right" data-numeric>
                {formatPoints(row.sonnebornBerger)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({
  children,
  className = "",
  numeric,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  numeric?: boolean;
  title?: string;
}) {
  return (
    <th
      scope="col"
      title={title}
      data-numeric={numeric ? "" : undefined}
      className={`label py-3 font-normal ${className}`}
    >
      {children}
    </th>
  );
}
