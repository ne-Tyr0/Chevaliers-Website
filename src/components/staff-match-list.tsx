import Link from "next/link";
import type { MatchupView } from "@/lib/club/queries";
import type { Terms } from "@/lib/terms";
import { CheckIcon, ChevronRight } from "./icons";
import { formatMatchupScore } from "./matchup-games";

/**
 * The matches of one round, for officers and arbiters, each a card that opens
 * its results page.
 *
 * Every card says how far along it is, so the list doubles as the checklist
 * for the meeting: finished ones are ticked, the rest say how many games are
 * still to enter.
 */
export function StaffMatchList({
  matches,
  nameById,
  terms,
  aside,
}: {
  matches: readonly MatchupView[];
  nameById: ReadonlyMap<string, string>;
  terms: Terms;
  /** An extra control beside a card, such as removing the match. */
  aside?: (view: MatchupView) => React.ReactNode;
}) {
  return (
    <ul className="space-y-2">
      {matches.map((view, index) => {
        const isBye = view.pairing.player_b_id === null;
        const left = view.games.filter((g) => g.result === "pending").length;
        const done = !isBye && left === 0;

        return (
          <li
            key={view.pairing.id}
            className="reveal flex flex-col gap-1.5 sm:flex-row sm:items-stretch sm:gap-2"
            style={{ "--i": index } as React.CSSProperties}
          >
            <Link
              href={`/matchup/${view.pairing.id}`}
              className="card-link flex min-w-0 flex-1 items-center gap-3 px-4 py-3"
            >
              <span className="text-muted w-7 shrink-0 text-sm tabular-nums">
                <span className="sr-only">{terms.board} </span>
                {view.pairing.board_number}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {nameById.get(view.pairing.player_a_id)}
                  {isBye ? (
                    <span className="text-muted font-normal"> · {terms.bye}</span>
                  ) : (
                    <>
                      <span className="text-muted mx-1.5 font-normal">v</span>
                      {nameById.get(view.pairing.player_b_id!)}
                    </>
                  )}
                </span>
                <span className="text-muted mt-0.5 block text-sm">
                  {done ? <CheckIcon className="mr-1 inline size-4 align-[-3px]" /> : null}
                  {isBye
                    ? "Nothing to enter"
                    : done
                      ? `All games entered · ${formatMatchupScore(view)}`
                      : `${left} of ${view.games.length} games to enter${
                          left < view.games.length ? ` · ${formatMatchupScore(view)}` : ""
                        }`}
                  {view.pairing.is_rematch ? ` · ${terms.rematch}` : ""}
                </span>
              </span>
              <span className="hidden text-sm font-medium sm:inline">
                {isBye ? "View" : done ? "Check" : "Enter results"}
              </span>
              <ChevronRight className="size-5 shrink-0" />
            </Link>
            {aside ? aside(view) : null}
          </li>
        );
      })}
    </ul>
  );
}
