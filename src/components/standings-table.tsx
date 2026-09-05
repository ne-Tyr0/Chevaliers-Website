import type { StandingRow } from "@/lib/swiss";

/** 1.5 rather than 1.50, and "½" where a half point reads more naturally. */
export function formatPoints(value: number): string {
  const whole = Math.floor(value);
  if (value - whole === 0.5) return whole === 0 ? "½" : `${whole}½`;
  return String(value);
}

export function StandingsTable({
  rows,
  nameById,
  highlightId,
}: {
  rows: readonly StandingRow[];
  nameById: ReadonlyMap<string, string>;
  /** The viewer's own row, given a tinted background so they can find it. */
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
                {nameById.get(row.playerId) ?? "Unknown player"}
                {row.byes > 0 ? (
                  <span className="text-faint ml-2 text-xs">
                    {row.byes === 1 ? "bye" : `${row.byes} byes`}
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
