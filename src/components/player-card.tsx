import type { GameRecord, StandingRow } from "@/lib/swiss";

/** 1.5 rather than 1.50, and "½" where a half point reads more naturally. */
export function formatPoints(value: number): string {
  const whole = Math.floor(value);
  if (value - whole === 0.5) return whole === 0 ? "½" : `${whole}½`;
  return String(value);
}

const OUTCOME_LABEL: Record<GameRecord["outcome"], string> = {
  win: "won",
  loss: "lost",
  draw: "drew",
  bye: "bye",
  forfeit_win: "won by default",
  forfeit_loss: "lost by default",
  double_forfeit: "double default",
};

/** How many recent games the card lists before it gets too tall to scan. */
const RECENT_GAMES = 5;

/**
 * The detail shown when someone hovers or taps a player.
 *
 * Deliberately more than the table has room for — colour balance, tiebreaks and
 * recent form — but still short enough to read at a glance.
 */
export function PlayerCard({
  name,
  grade,
  row,
  games,
  nameById,
}: {
  name: string;
  grade?: string | null;
  row: StandingRow;
  games: readonly GameRecord[];
  nameById: ReadonlyMap<string, string>;
}) {
  const whites = games.filter((g) => g.color === "white").length;
  const blacks = games.filter((g) => g.color === "black").length;
  const recent = games.slice().sort((a, b) => b.roundNumber - a.roundNumber);

  return (
    <div>
      <p className="font-display text-base font-semibold">{name}</p>
      <p className="text-faint mt-0.5 text-xs">
        {grade ? `${grade} · ` : ""}
        {ordinal(row.rank)} · {formatPoints(row.score)}{" "}
        {row.score === 1 ? "point" : "points"} from {row.gamesPlayed}{" "}
        {row.gamesPlayed === 1 ? "game" : "games"}
      </p>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <Stat label="Won" value={row.wins} />
        <Stat label="Drawn" value={row.draws} />
        <Stat label="Lost" value={row.losses} />
        <Stat
          label="White / Black"
          value={whites + blacks === 0 ? "—" : `${whites} / ${blacks}`}
        />
        <Stat label="Buchholz" value={formatPoints(row.buchholz)} />
        <Stat label="Sonneborn-Berger" value={formatPoints(row.sonnebornBerger)} />
        {row.byes > 0 ? <Stat label="Byes" value={row.byes} /> : null}
        {row.forfeitWins > 0 ? (
          <Stat label="Won by default" value={row.forfeitWins} />
        ) : null}
        {row.forfeitLosses > 0 ? (
          <Stat label="Lost by default" value={row.forfeitLosses} />
        ) : null}
      </dl>

      {recent.length > 0 ? (
        <div className="mt-3 border-t pt-2" style={{ borderColor: "var(--rule)" }}>
          <p className="label">Recent games</p>
          <ul className="mt-1.5 space-y-1 text-xs">
            {recent.slice(0, RECENT_GAMES).map((game, index) => (
              // Three games against the same opponent in the same round share
              // every field, so the position is the only unique part.
              <li
                key={`${game.roundNumber}-${game.opponentId ?? "bye"}-${index}`}
                className="flex justify-between gap-3"
              >
                <span className="text-muted truncate">
                  R{game.roundNumber}{" "}
                  {game.opponentId
                    ? (nameById.get(game.opponentId) ?? "Unknown")
                    : "bye"}
                </span>
                <span className="text-faint shrink-0">
                  {OUTCOME_LABEL[game.outcome]}
                  {game.color ? ` · ${game.color === "white" ? "W" : "B"}` : ""}
                </span>
              </li>
            ))}
          </ul>
          {recent.length > RECENT_GAMES ? (
            <p className="text-faint mt-1.5 text-xs">
              and {recent.length - RECENT_GAMES} earlier
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-faint mt-3 text-xs">No games yet this season.</p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-faint">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}

function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}
