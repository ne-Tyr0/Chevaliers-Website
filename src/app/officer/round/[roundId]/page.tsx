import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ReviewBanner, ReviewGate } from "@/components/review-gate";
import { StaffMatchList } from "@/components/staff-match-list";
import {
  EmptyState,
  ErrorNote,
  Note,
  PageHeader,
  RoundStatusTag,
  formatDate,
} from "@/components/ui";
import { setRoundColorTracking } from "@/lib/club/actions";
import { getRound, getRoundMatchups, getRoster } from "@/lib/club/queries";
import { getTerms } from "@/lib/club/wording";
import { currentRole, reviewExpiresAt } from "@/lib/officer/session";

export const metadata: Metadata = { title: "Round" };

/**
 * One round of the season, for looking back over.
 *
 * Results are corrected on each matchup's own page; this is the way in. The
 * round's own shape — who is paired with whom — is deliberately not editable
 * here: re-pairing a round that has been played would invent games nobody sat
 * down for.
 */
export default async function RoundPage({
  params,
  searchParams,
}: PageProps<"/officer/round/[roundId]">) {
  const role = await currentRole();
  if (role !== "officer") redirect("/officer");

  const { roundId } = await params;
  const { error } = await searchParams;

  const round = await getRound(roundId);
  if (!round) notFound();

  const [matches, roster, reviewUntil, terms] = await Promise.all([
    getRoundMatchups(roundId),
    getRoster(),
    reviewExpiresAt(),
    getTerms(),
  ]);

  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const returnTo = `/officer/round/${roundId}`;
  const closed = round.status === "completed";
  const outstanding = matches.reduce(
    (sum, view) =>
      sum +
      (view.pairing.player_b_id === null
        ? 0
        : view.games.filter((g) => g.result === "pending").length),
    0,
  );

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <PageHeader
          crumbs={[
            { href: "/officer", label: "Officer tools" },
            { href: "/officer?tab=rounds", label: "All rounds" },
          ]}
          title={`Round ${round.round_number}`}
        />
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <RoundStatusTag status={round.status} />
          <span className="tag">{formatDate(round.played_on)}</span>
          <span className="tag">
            {matches.length} {matches.length === 1 ? terms.match : terms.matches}
          </span>
          {outstanding > 0 ? (
            <span className="tag">{outstanding} games not entered</span>
          ) : null}
          {!round.tracks_colors ? <span className="tag">Colours not recorded</span> : null}
        </p>

        {typeof error === "string" ? <ErrorNote>{error}</ErrorNote> : null}

        {closed && reviewUntil === null ? (
          <ReviewGate returnTo={returnTo} roundNumber={round.round_number} />
        ) : null}
        {closed && reviewUntil !== null ? (
          <ReviewBanner returnTo={returnTo} expiresAt={reviewUntil} />
        ) : null}

        {matches.length === 0 ? (
          <EmptyState>This round has no {terms.matches}.</EmptyState>
        ) : (
          <div className="mt-6">
            <StaffMatchList matches={matches} nameById={nameById} terms={terms} />
          </div>
        )}

        {!closed ? (
          <form action={setRoundColorTracking} className="card mt-10 p-5">
            <input type="hidden" name="roundId" value={round.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input
              type="hidden"
              name="tracks"
              value={round.tracks_colors ? "false" : "true"}
            />
            <h2 className="text-lg">Recording who had White</h2>
            <p className="text-muted mt-1 max-w-prose leading-relaxed">
              {round.tracks_colors
                ? "This round asks who had White in each game. Turn that off for a round being entered from paper, where nobody wrote it down."
                : "This round does not ask who had White. Anything already recorded is kept, just not asked for."}
            </p>
            <button type="submit" className="btn mt-4">
              {round.tracks_colors ? "Stop asking for colours" : "Ask for colours"}
            </button>
          </form>
        ) : null}

        {closed && reviewUntil === null ? (
          <Note>
            Who played whom never changes once a round has been played — that
            would invent games nobody sat down for. Only results and colours can
            be corrected.
          </Note>
        ) : null}
      </main>
    </>
  );
}
