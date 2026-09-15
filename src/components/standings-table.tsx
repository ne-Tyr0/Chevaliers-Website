import Link from "next/link";
import type { StandingRow } from "@/lib/swiss";
import { LeaderMark } from "./chess-motion";
import { formatPoints, type Terms } from "@/lib/terms";

/**
 * The season table.
 *
 * Every name is a link to that player's page. Their detail used to live in a
 * card that opened on hover, which a phone has no way to discover and which
 * hid the only route to a player's games; a page can be found, shared and
 * returned to.
 *
 * Narrow screens drop columns rather than side-scroll, and nothing dropped is
 * lost: the player page carries the full record. The tiebreak columns appear
 * only with chess terms on — in everyday wording they would be two unexplained
 * numbers, and the player page explains them instead.
 */
export function StandingsTable({
  rows,
  nameById,
  gradeById,
  terms,
  highlightId,
}: {
  rows: readonly StandingRow[];
  nameById: ReadonlyMap<string, string>;
  /** Grade and section per player, as the club's pairing sheets identify them. */
  gradeById?: ReadonlyMap<string, string | null>;
  terms: Terms;
  /** A row to tint, so a reader can find themselves. */
  highlightId?: string;
}) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-[0.9375rem]">
        <caption className="sr-only">
          Standings. Select a player&rsquo;s name to see their games.
        </caption>
        <thead>
          <tr className="border-b" style={{ borderColor: "var(--rule-strong)" }}>
            <Th className="w-12 pl-4 text-left sm:pl-5">
              <span aria-hidden>#</span>
              <span className="sr-only">Place</span>
            </Th>
            <Th className="pr-3 text-left">Player</Th>
            <Th className="pr-4 text-right" numeric>
              {terms.points}
            </Th>
            <Th className="pr-4 text-right sm:pr-5" numeric>
              {terms.gamesPlayed}
            </Th>
            <Th className="hidden pr-5 text-right md:table-cell" numeric>
              {terms.record}
            </Th>
            {terms.chess ? (
              <>
                <Th
                  className="hidden pr-5 text-right lg:table-cell"
                  numeric
                  title={terms.buchholzHint}
                >
                  Buch.
                </Th>
                <Th
                  className="hidden pr-5 text-right lg:table-cell"
                  numeric
                  title={terms.sonnebornBergerHint}
                >
                  S–B
                </Th>
              </>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const name = nameById.get(row.playerId) ?? "Unknown player";
            const grade = gradeById?.get(row.playerId);
            const forfeits = row.forfeitWins + row.forfeitLosses;
            const podium = row.rank <= 3;

            return (
              <tr
                key={row.playerId}
                className="border-b transition-colors last:border-b-0 hover:bg-cream-deep"
                style={{
                  borderColor: "var(--rule)",
                  backgroundColor:
                    row.playerId === highlightId
                      ? "var(--color-cream-deep)"
                      : undefined,
                }}
              >
                <td
                  className={`py-3 pr-2 pl-4 align-top tabular-nums sm:pl-5 ${podium ? "font-semibold" : "text-muted"}`}
                  data-numeric
                >
                  <span className="inline-flex items-center gap-1">
                    {row.rank}
                    {row.rank === 1 ? <LeaderMark /> : null}
                  </span>
                </td>
                <td className="py-3 pr-3 align-top">
                  <Link
                    href={`/players/${row.playerId}`}
                    className={`link ${podium ? "font-semibold" : ""}`}
                  >
                    {name}
                  </Link>
                  {grade || row.byes > 0 || forfeits > 0 ? (
                    <span className="text-muted mt-0.5 block text-xs">
                      {[
                        grade,
                        row.byes > 0 ? terms.byes(row.byes) : null,
                        forfeits > 0 ? terms.forfeits(forfeits) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  ) : null}
                </td>
                <td
                  className="py-3 pr-4 text-right align-top font-semibold whitespace-nowrap"
                  data-numeric
                >
                  {formatPoints(row.score)}
                </td>
                <td
                  className="text-muted py-3 pr-4 text-right align-top whitespace-nowrap sm:pr-5"
                  data-numeric
                >
                  {row.gamesPlayed}
                </td>
                <td
                  className="text-muted hidden py-3 pr-5 text-right align-top whitespace-nowrap md:table-cell"
                  data-numeric
                >
                  {row.wins} · {row.draws} · {row.losses}
                </td>
                {terms.chess ? (
                  <>
                    <td
                      className="text-muted hidden py-3 pr-5 text-right align-top whitespace-nowrap lg:table-cell"
                      data-numeric
                    >
                      {formatPoints(row.buchholz)}
                    </td>
                    <td
                      className="text-muted hidden py-3 pr-5 text-right align-top whitespace-nowrap lg:table-cell"
                      data-numeric
                    >
                      {formatPoints(row.sonnebornBerger)}
                    </td>
                  </>
                ) : null}
              </tr>
            );
          })}
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
      className={`label py-3 font-medium ${className}`}
    >
      {children}
    </th>
  );
}
