import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { formatMatchupScore } from "@/components/matchup-games";
import { Pawn } from "@/components/pawn";
import { SiteHeader } from "@/components/site-header";
import { getActiveSeason, getRoster, getRoundMatchups, getSeasonRounds } from "@/lib/club/queries";
import { currentRole } from "@/lib/officer/session";

export const metadata: Metadata = { title: "Arbiter tools" };

/**
 * What an arbiter sees: the open round, and nothing else.
 *
 * No roster, no seasons, no past rounds — the smallest surface that still lets
 * them report results at the board.
 */
export default async function ArbiterPage() {
  const role = await currentRole();
  if (!role) redirect("/officer");

  const season = await getActiveSeason();
  const rounds = season ? await getSeasonRounds(season.id) : [];
  const openRound =
    rounds.filter((r) => r.status !== "completed").at(-1) ?? rounds.at(-1) ?? null;
  const matchups = openRound ? await getRoundMatchups(openRound.id) : [];
  const roster = await getRoster();
  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));

  return (
    <>
      <SiteHeader role={role} currentPath="/arbiter" />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <p className="label">Arbiter</p>
        <h1 className="mt-3 text-4xl">Report results</h1>

        {!openRound || matchups.length === 0 ? (
          <div
            className="mt-10 flex items-start gap-4 border-t pt-8"
            style={{ borderColor: "var(--rule)" }}
          >
            <Pawn className="text-faint mt-0.5 h-5 w-auto shrink-0" />
            <p className="text-muted max-w-prose text-sm leading-relaxed">
              No round is open yet. An officer needs to start one and generate the
              matchups before there is anything to report.
            </p>
          </div>
        ) : (
          <>
            <p className="text-muted mt-3 text-sm">
              Round {openRound.round_number}. Open a matchup to enter its games.
            </p>

            <ul className="mt-8">
              {matchups.map((view) => {
                const outstanding = view.games.filter(
                  (g) => g.result === "pending",
                ).length;
                const isBye = view.pairing.player_b_id === null;

                return (
                  <li
                    key={view.pairing.id}
                    className="border-b"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <Link
                      href={`/matchup/${view.pairing.id}`}
                      className="flex items-center gap-4 py-4 transition-colors hover:bg-cream-deep"
                    >
                      <span className="text-faint w-6 text-sm" data-numeric>
                        {view.pairing.board_number}
                      </span>
                      <span className="min-w-0 flex-1 text-sm">
                        {nameById.get(view.pairing.player_a_id)}
                        {isBye ? (
                          <span className="text-faint"> — bye</span>
                        ) : (
                          <>
                            <span className="text-faint mx-2">v</span>
                            {nameById.get(view.pairing.player_b_id!)}
                          </>
                        )}
                      </span>
                      <span className="text-sm tabular-nums whitespace-nowrap">
                        {isBye ? (
                          <span className="text-faint text-xs">—</span>
                        ) : (
                          formatMatchupScore(view)
                        )}
                      </span>
                      <span className="text-faint w-24 text-right text-xs">
                        {isBye
                          ? ""
                          : outstanding === 0
                            ? "complete"
                            : `${outstanding} to go`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>

            <p className="text-faint mt-8 max-w-prose text-xs leading-relaxed">
              You can enter and correct results and forfeits for this round.
              Starting rounds, pairing, the roster and closing the round are
              officer tasks.
            </p>
          </>
        )}
      </main>
    </>
  );
}
