import type { GameRecord, StandingRow } from "@/lib/swiss";
import { formatPoints, PlayerCard } from "./player-card";
import { StatPopover } from "./stat-popover";

export { formatPoints };

export function StandingsTable({
  rows,
  nameById,
  gradeById,
  gamesByPlayer,
  highlightId,
}: {
  rows: readonly StandingRow[];
  nameById: ReadonlyMap<string, string>;
  /** Grade and section per player, as the club's pairing sheets identify them. */
  gradeById?: ReadonlyMap<string, string | null>;
  /** Per-player history, used to fill the hover card. */
  gamesByPlayer: ReadonlyMap<string, GameRecord[]>;
  /** A row to tint, so a reader can find themselves. */
  highlightId?: string;
}) {
  /*
   * Narrow screens drop columns rather than side-scroll. A 36rem floor is
   * wider than any phone, which turned the table into a nested scroller inside
   * a page that also scrolled — awkward to read, and easy to miss that there
   * was anything to the right. Everything hidden here is still one tap away in
   * the player card, which carries the full record.
   */
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--rule-strong)" }}>
            <Th className="pr-2 text-left sm:pr-3">#</Th>
            <Th className="w-full pr-3 text-left sm:pr-6">Player</Th>
            <Th className="pr-3 text-right sm:pr-6" numeric>
              Score
            </Th>
            <Th className="pr-3 text-right sm:pr-6" numeric>
              Played
            </Th>
            <Th className="hidden pr-6 text-right sm:table-cell" numeric>
              W–D–L
            </Th>
            <Th
              className="hidden pr-6 text-right md:table-cell"
              numeric
              title="Buchholz — sum of opponents' scores"
            >
              Buch.
            </Th>
            <Th
              className="hidden text-right md:table-cell"
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
              <td className="text-faint py-3 pr-2 align-top sm:pr-3" data-numeric>
                {row.rank}
              </td>
              <td className="py-3 pr-3 sm:pr-6">
                <StatPopover
                  label={nameById.get(row.playerId) ?? "Unknown player"}
                >
                  <PlayerCard
                    name={nameById.get(row.playerId) ?? "Unknown player"}
                    grade={gradeById?.get(row.playerId) ?? null}
                    row={row}
                    games={gamesByPlayer.get(row.playerId) ?? []}
                    nameById={nameById}
                  />
                </StatPopover>
                {gradeById?.get(row.playerId) ? (
                  <span className="text-faint ml-2 text-xs">
                    {gradeById.get(row.playerId)}
                  </span>
                ) : null}
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
              <td
                className="py-3 pr-3 text-right align-top font-medium whitespace-nowrap sm:pr-6"
                data-numeric
              >
                {formatPoints(row.score)}
              </td>
              <td
                className="text-muted py-3 pr-3 text-right align-top whitespace-nowrap sm:pr-6"
                data-numeric
              >
                {row.gamesPlayed}
              </td>
              <td
                className="text-muted hidden py-3 pr-6 text-right align-top whitespace-nowrap sm:table-cell"
                data-numeric
              >
                {row.wins}–{row.draws}–{row.losses}
              </td>
              <td
                className="text-faint hidden py-3 pr-6 text-right align-top whitespace-nowrap md:table-cell"
                data-numeric
              >
                {formatPoints(row.buchholz)}
              </td>
              <td
                className="text-faint hidden py-3 text-right align-top whitespace-nowrap md:table-cell"
                data-numeric
              >
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
