import { recordGame, setGameColor } from "@/lib/club/actions";
import type { MatchupView } from "@/lib/club/queries";
import { matchupScore } from "@/lib/club/queries";
import type { DbPairingResult } from "@/lib/supabase/database.types";
import { CHESS_RESULT, formatPoints, shortName, type Terms } from "@/lib/terms";
import { CheckIcon } from "./icons";

/** "2 – 1", or "1½ – 1½". */
export function formatMatchupScore(view: MatchupView): string {
  const { a, b } = matchupScore(view);
  return `${formatPoints(a)} – ${formatPoints(b)}`;
}

/**
 * The three games of a matchup, with the controls to report them.
 *
 * Each game is its own card, asking its questions in the order they are
 * settled at the board: who had White, then how it ended. Results are named
 * in words — "Juliana won" — unless chess terms are on, so an arbiter who has
 * never met "1–0" cannot record it the wrong way round.
 *
 * Colours are recorded per game rather than assigned by the pairing engine,
 * because they are settled at the board. Whoever is entering the result says
 * who had White.
 */
export function MatchupGames({
  view,
  nameA,
  nameB,
  returnTo,
  terms,
  tracksColors = true,
  readOnly = false,
}: {
  view: MatchupView;
  nameA: string;
  nameB: string;
  returnTo: string;
  terms: Terms;
  /** False for a round entered from paper, where nobody noted who had White. */
  tracksColors?: boolean;
  /** True for a closed round with no review window open. */
  readOnly?: boolean;
}) {
  if (view.pairing.player_b_id === null) {
    return (
      <p className="card text-muted mt-6 p-5">
        {nameA} has a {terms.bye} this round, worth a whole {terms.match}. There
        is nothing to report.
      </p>
    );
  }

  const a = shortName(nameA);
  const b = shortName(nameB);

  const played: { value: DbPairingResult; label: string }[] = terms.chess
    ? [
        { value: "a_win", label: CHESS_RESULT.a_win },
        { value: "draw", label: CHESS_RESULT.draw },
        { value: "b_win", label: CHESS_RESULT.b_win },
      ]
    : [
        { value: "a_win", label: `${a} won` },
        { value: "draw", label: "Draw" },
        { value: "b_win", label: `${b} won` },
      ];
  const unplayed: { value: DbPairingResult; label: string }[] = terms.chess
    ? [
        { value: "a_forfeit_win", label: CHESS_RESULT.a_forfeit_win },
        { value: "b_forfeit_win", label: CHESS_RESULT.b_forfeit_win },
        { value: "double_forfeit", label: CHESS_RESULT.double_forfeit },
      ]
    : [
        { value: "a_forfeit_win", label: `${b} absent` },
        { value: "b_forfeit_win", label: `${a} absent` },
        { value: "double_forfeit", label: "Both absent" },
      ];

  return (
    <ol className="mt-6 space-y-4">
      {view.games.map((game) => {
        const whiteIsA = game.color_a === "white";
        const whiteIsB = game.color_a === "black";
        const done = game.result !== "pending";

        return (
          <li key={game.id} className="card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl">Game {game.game_number}</h2>
              {done ? (
                <span className="tag tag-strong">
                  <CheckIcon className="size-3.5" />
                  {terms.gameResult(game.result, a, b)}
                </span>
              ) : (
                <span className="tag">Not entered yet</span>
              )}
            </div>

            {tracksColors ? (
              <fieldset className="mt-4">
                <legend className="label">Who had White?</legend>
                {readOnly ? (
                  <p className="mt-1">
                    {whiteIsA ? nameA : whiteIsB ? nameB : "Not recorded"}
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <ColorButton
                      gameId={game.id}
                      colorA="white"
                      label={a}
                      selected={whiteIsA}
                      returnTo={returnTo}
                    />
                    <ColorButton
                      gameId={game.id}
                      colorA="black"
                      label={b}
                      selected={whiteIsB}
                      returnTo={returnTo}
                    />
                  </div>
                )}
              </fieldset>
            ) : null}

            {readOnly ? null : (
              <>
                <fieldset className="mt-4">
                  <legend className="label">How did it end?</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {played.map((option) => (
                      <ResultButton
                        key={option.value}
                        gameId={game.id}
                        value={option.value}
                        label={option.label}
                        hint={terms.gameResult(option.value, a, b)}
                        selected={game.result === option.value}
                        returnTo={returnTo}
                      />
                    ))}
                  </div>
                </fieldset>
                <fieldset className="mt-3">
                  <legend className="label">
                    {terms.chess ? "Forfeits" : "Not played?"}
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {unplayed.map((option) => (
                      <ResultButton
                        key={option.value}
                        gameId={game.id}
                        value={option.value}
                        label={option.label}
                        hint={terms.gameResult(option.value, a, b)}
                        selected={game.result === option.value}
                        returnTo={returnTo}
                        quiet
                      />
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            {game.updated_by && done ? (
              <p className="text-muted mt-4 text-sm">
                Entered by {game.updated_by}
                {readOnly ? "" : ". Press the chosen result again to clear it."}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

function ColorButton({
  gameId,
  colorA,
  label,
  selected,
  returnTo,
}: {
  gameId: string;
  colorA: "white" | "black";
  label: string;
  selected: boolean;
  returnTo: string;
}) {
  return (
    <form action={setGameColor}>
      <input type="hidden" name="gameId" value={gameId} />
      {/* Choosing again clears it, in case it was recorded the wrong way round. */}
      <input type="hidden" name="colorA" value={selected ? "" : colorA} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-pressed={selected}
        className="btn btn-sm max-w-[14rem]"
      >
        {selected ? <CheckIcon className="size-4 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </button>
    </form>
  );
}

function ResultButton({
  gameId,
  value,
  label,
  hint,
  selected,
  returnTo,
  quiet,
}: {
  gameId: string;
  value: string;
  label: string;
  /** Spelled out for screen readers and hover, since chess labels are symbols. */
  hint: string;
  selected: boolean;
  returnTo: string;
  quiet?: boolean;
}) {
  return (
    <form action={recordGame}>
      <input type="hidden" name="gameId" value={gameId} />
      {/* Pressing the current result again clears it back to unreported. */}
      <input type="hidden" name="result" value={selected ? "pending" : value} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <button
        type="submit"
        aria-pressed={selected}
        aria-label={hint === label ? undefined : `${label}: ${hint}`}
        title={hint === label ? undefined : hint}
        className={`${quiet ? "btn-quiet" : "btn btn-sm"} min-w-12 max-w-[14rem]`}
      >
        {selected ? <CheckIcon className="size-4 shrink-0" /> : null}
        <span className="truncate">{label}</span>
      </button>
    </form>
  );
}
