import Link from "next/link";
import { matchupScore, type MatchupView } from "@/lib/club/queries";
import { formatPoints, shortName, type Terms } from "@/lib/terms";
import { ChevronDown } from "./icons";

/**
 * One match, laid out like a scoreboard: a line per player with their score,
 * the winner in bold.
 *
 * The old row put both names and a "2 – 1" on one line, which a phone could
 * only fit by squeezing each name to a hundred pixels, and left the reader to
 * work out which side the score belonged to. One line per player needs no
 * working out, reads the same at any width, and gives each name room.
 */
export function MatchCard({
  view,
  nameById,
  terms,
  tracksColors = true,
  showGames = true,
}: {
  view: MatchupView;
  nameById: ReadonlyMap<string, string>;
  terms: Terms;
  tracksColors?: boolean;
  showGames?: boolean;
}) {
  const { pairing } = view;
  const nameA = nameById.get(pairing.player_a_id) ?? "Unknown player";
  const nameB = pairing.player_b_id
    ? (nameById.get(pairing.player_b_id) ?? "Unknown player")
    : null;
  const { a, b } = matchupScore(view);
  const reported = view.games.filter((g) => g.result !== "pending").length;
  const finished = nameB !== null && reported === view.games.length && reported > 0;

  const summary =
    nameB === null
      ? terms.chess
        ? "Bye"
        : `Free round for ${shortName(nameA)}, worth a won match`
      : reported === 0
        ? "Not played yet"
        : !finished
          ? `In progress · ${reported} of ${view.games.length} games in`
          : a > b
            ? `${shortName(nameA)} won`
            : b > a
              ? `${shortName(nameB)} won`
              : "Drawn";

  return (
    <article className="card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-muted text-sm">
          {terms.board} {pairing.board_number}
          {pairing.is_rematch ? ` · ${terms.rematch}` : ""}
        </p>
        <p className="text-sm font-medium">{summary}</p>
      </div>

      <ul className="mt-3 space-y-1.5">
        <PlayerLine
          id={pairing.player_a_id}
          name={nameA}
          score={nameB === null ? null : a}
          leading={finished && a > b}
        />
        {pairing.player_b_id && nameB ? (
          <PlayerLine
            id={pairing.player_b_id}
            name={nameB}
            score={b}
            leading={finished && b > a}
          />
        ) : null}
      </ul>

      {showGames && nameB !== null && view.games.length > 0 ? (
        <details className="group mt-3">
          <summary className="btn-quiet w-fit list-none">
            <span className="group-open:hidden">
              Show the {view.games.length} games
            </span>
            <span className="hidden group-open:inline">Hide games</span>
            <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
          </summary>
          <ol className="mt-3 space-y-2 border-t pt-3" style={{ borderColor: "var(--rule)" }}>
            {view.games.map((game) => {
              const white =
                game.color_a === "white"
                  ? nameA
                  : game.color_a === "black"
                    ? nameB
                    : null;
              return (
                <li
                  key={game.id}
                  className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm"
                >
                  <span>
                    <span className="font-medium">Game {game.game_number}</span>
                    {tracksColors ? (
                      <span className="text-muted">
                        {" · "}
                        {white ? `${shortName(white)} had White` : "colours not noted"}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      game.result === "pending" ? "text-muted" : "tabular-nums"
                    }
                  >
                    {terms.gameResult(game.result, shortName(nameA), shortName(nameB))}
                  </span>
                </li>
              );
            })}
          </ol>
        </details>
      ) : null}
    </article>
  );
}

function PlayerLine({
  id,
  name,
  score,
  leading,
}: {
  id: string;
  name: string;
  score: number | null;
  leading: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-4">
      <Link
        href={`/players/${id}`}
        className={`link min-w-0 py-1 text-base ${leading ? "font-semibold" : ""}`}
      >
        {name}
      </Link>
      {score !== null ? (
        <span
          className={`text-lg tabular-nums ${leading ? "font-semibold" : "text-muted"}`}
        >
          {formatPoints(score)}
        </span>
      ) : null}
    </li>
  );
}
