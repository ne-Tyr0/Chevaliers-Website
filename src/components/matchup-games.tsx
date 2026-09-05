import { recordGame, setGameColor } from "@/lib/club/actions";
import type { MatchupView } from "@/lib/club/queries";
import { matchupScore } from "@/lib/club/queries";

export const PLAYED_RESULTS = [
  { value: "a_win", label: "1–0" },
  { value: "draw", label: "½–½" },
  { value: "b_win", label: "0–1" },
] as const;

export const FORFEIT_RESULTS = [
  { value: "a_forfeit_win", label: "+ −" },
  { value: "b_forfeit_win", label: "− +" },
  { value: "double_forfeit", label: "− −" },
] as const;

/** "2 – 1", or "1½ – 1½". */
export function formatMatchupScore(view: MatchupView): string {
  const { a, b } = matchupScore(view);
  return `${half(a)} – ${half(b)}`;
}

function half(value: number): string {
  const whole = Math.floor(value);
  if (value - whole === 0.5) return whole === 0 ? "½" : `${whole}½`;
  return String(value);
}

/**
 * The three games of a matchup, with the controls to report them.
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
}: {
  view: MatchupView;
  nameA: string;
  nameB: string;
  returnTo: string;
}) {
  if (view.pairing.player_b_id === null) {
    return (
      <p className="text-muted mt-6 text-sm">
        {nameA} has the bye this round, worth a full matchup. There is nothing to
        report.
      </p>
    );
  }

  return (
    <ul className="mt-6">
      {view.games.map((game) => {
        const whiteIsA = game.color_a === "white";
        const whiteIsB = game.color_a === "black";

        return (
          <li
            key={game.id}
            className="border-b py-4"
            style={{ borderColor: "var(--rule)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
              <span className="label">Game {game.game_number}</span>

              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-faint text-xs">White</span>
                  <ColorButton
                    gameId={game.id}
                    colorA="white"
                    label={nameA}
                    selected={whiteIsA}
                    returnTo={returnTo}
                  />
                  <ColorButton
                    gameId={game.id}
                    colorA="black"
                    label={nameB}
                    selected={whiteIsB}
                    returnTo={returnTo}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {PLAYED_RESULTS.map((option) => (
                    <ResultButton
                      key={option.value}
                      gameId={game.id}
                      value={option.value}
                      label={option.label}
                      selected={game.result === option.value}
                      returnTo={returnTo}
                    />
                  ))}
                  <span aria-hidden className="text-faint px-0.5 text-xs">
                    |
                  </span>
                  {FORFEIT_RESULTS.map((option) => (
                    <ResultButton
                      key={option.value}
                      gameId={game.id}
                      value={option.value}
                      label={option.label}
                      selected={game.result === option.value}
                      returnTo={returnTo}
                      muted
                    />
                  ))}
                </div>
              </div>
            </div>

            {game.updated_by && game.result !== "pending" ? (
              <p className="text-faint mt-2 text-xs">
                Entered by {game.updated_by}
              </p>
            ) : null}
          </li>
        );
      })}
    </ul>
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
        className="max-w-[7rem] cursor-pointer truncate border px-3 py-2 text-xs transition-colors hover:bg-ink hover:text-cream sm:max-w-[9rem] sm:px-2 sm:py-1"
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
        {label}
      </button>
    </form>
  );
}

function ResultButton({
  gameId,
  value,
  label,
  selected,
  returnTo,
  muted,
}: {
  gameId: string;
  value: string;
  label: string;
  selected: boolean;
  returnTo: string;
  muted?: boolean;
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
        className={`min-w-11 cursor-pointer border px-3 py-2 text-xs transition-colors hover:bg-ink hover:text-cream sm:min-w-0 sm:px-2 sm:py-1 ${
          muted && !selected ? "text-faint" : ""
        }`}
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
        {label}
      </button>
    </form>
  );
}
