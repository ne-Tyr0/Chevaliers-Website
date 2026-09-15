import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffMatchList } from "@/components/staff-match-list";
import { EmptyState, Note, PageHeader, WordingToggle } from "@/components/ui";
import {
  getActiveSeason,
  getRoster,
  getRoundMatchups,
  getSeasonRounds,
} from "@/lib/club/queries";
import { getTerms } from "@/lib/club/wording";
import { currentRole } from "@/lib/officer/session";

export const metadata: Metadata = { title: "Report results" };

/**
 * What an arbiter sees: the open round, and nothing else.
 *
 * No roster, no seasons, no past rounds — the smallest surface that still lets
 * them report results at the board.
 */
export default async function ArbiterPage() {
  const role = await currentRole();
  if (!role) redirect("/officer");

  const [season, roster, terms] = await Promise.all([
    getActiveSeason(),
    getRoster(),
    getTerms(),
  ]);
  const rounds = season ? await getSeasonRounds(season.id) : [];
  const openRound =
    rounds.filter((r) => r.status !== "completed").at(-1) ?? rounds.at(-1) ?? null;
  const matches = openRound ? await getRoundMatchups(openRound.id) : [];
  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));

  const games = matches.filter((m) => m.pairing.player_b_id !== null).flatMap((m) => m.games);
  const entered = games.filter((g) => g.result !== "pending").length;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <PageHeader
          eyebrow={openRound ? `Round ${openRound.round_number}` : "Arbiter"}
          title="Report results"
          description={
            openRound && matches.length > 0
              ? `Choose a ${terms.match}, then enter who had White and how each game ended.`
              : undefined
          }
        />

        {!openRound || matches.length === 0 ? (
          <EmptyState>
            No round is ready yet. An officer needs to start one and pair the
            players before there is anything to report. Check back once they
            have.
          </EmptyState>
        ) : (
          <>
            <div className="card mt-6 p-4 sm:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">
                  {entered} of {games.length} games entered
                </p>
                <p className="text-muted text-sm">
                  {games.length - entered === 0
                    ? "Everything is in. An officer can now finish the round."
                    : `${games.length - entered} to go`}
                </p>
              </div>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full"
                style={{ backgroundColor: "var(--color-cream-deep)" }}
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={games.length}
                aria-valuenow={entered}
                aria-label="Games entered"
              >
                <div
                  className="bg-ink h-full rounded-full"
                  style={{ width: `${games.length ? (entered / games.length) * 100 : 0}%` }}
                />
              </div>
            </div>

            <WordingToggle terms={terms} returnTo="/arbiter" className="mt-5" />

            <div className="mt-5">
              <StaffMatchList matches={matches} nameById={nameById} terms={terms} />
            </div>

            <Note>
              You can enter and correct results for this round. Starting rounds,
              pairing players, the roster and finishing the round are done by
              officers.
            </Note>
          </>
        )}
      </main>
    </>
  );
}
