import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { formatMatchupScore, MatchupGames } from "@/components/matchup-games";
import { ReviewBanner, ReviewGate } from "@/components/review-gate";
import { ErrorNote, Note, PageHeader, WordingToggle } from "@/components/ui";
import { getMatchup, getRound, getRoster } from "@/lib/club/queries";
import { getTerms } from "@/lib/club/wording";
import { currentRole, reviewExpiresAt } from "@/lib/officer/session";

export const metadata: Metadata = { title: "Enter results" };

export default async function MatchupPage({
  params,
  searchParams,
}: PageProps<"/matchup/[pairingId]">) {
  const role = await currentRole();
  if (!role) redirect("/officer");

  const { pairingId } = await params;
  const { error } = await searchParams;

  const [view, roster, terms] = await Promise.all([
    getMatchup(pairingId),
    getRoster(),
    getTerms(),
  ]);
  if (!view) notFound();

  const round = await getRound(view.pairing.round_id);
  const reviewUntil = await reviewExpiresAt();
  // A closed round is readable by anyone holding a passcode, but only editable
  // inside the review window, which is officers-only.
  const closed = round?.status === "completed";
  const readOnly = closed && reviewUntil === null;

  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const nameA = nameById.get(view.pairing.player_a_id) ?? "Unknown player";
  const nameB = view.pairing.player_b_id
    ? (nameById.get(view.pairing.player_b_id) ?? "Unknown player")
    : "Bye";

  // Back to wherever this matchup was opened from, in words that say what it is.
  const crumbs =
    role === "officer"
      ? closed && round
        ? [
            { href: "/officer", label: "Officer tools" },
            { href: `/officer/round/${round.id}`, label: `Round ${round.round_number}` },
          ]
        : [{ href: "/officer", label: "Officer tools" }]
      : [{ href: "/arbiter", label: "Report results" }];

  const returnTo = `/matchup/${pairingId}`;
  const outstanding = view.games.filter((g) => g.result === "pending").length;

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <PageHeader
          crumbs={crumbs}
          eyebrow={`${round ? `Round ${round.round_number} · ` : ""}${terms.board} ${view.pairing.board_number}`}
          title={
            <>
              {nameA} <span className="text-muted font-normal">v</span> {nameB}
            </>
          }
        />

        {view.pairing.player_b_id ? (
          <p className="mt-4 flex flex-wrap items-center gap-2">
            <span className="tag tag-strong tabular-nums">
              {formatMatchupScore(view)}
            </span>
            <span className="tag">
              {outstanding > 0
                ? `${outstanding} of ${view.games.length} games still to enter`
                : "All games entered"}
            </span>
          </p>
        ) : null}

        <WordingToggle terms={terms} returnTo={returnTo} className="mt-5" />

        {typeof error === "string" ? <ErrorNote>{error}</ErrorNote> : null}

        {closed && readOnly ? (
          <ReviewGate returnTo={returnTo} roundNumber={round.round_number} />
        ) : null}
        {closed && reviewUntil !== null ? (
          <ReviewBanner returnTo={returnTo} expiresAt={reviewUntil} />
        ) : null}

        <MatchupGames
          view={view}
          nameA={nameA}
          nameB={nameB}
          returnTo={returnTo}
          terms={terms}
          tracksColors={round?.tracks_colors ?? true}
          readOnly={readOnly}
        />

        {view.pairing.is_rematch ? (
          <Note>
            These two have played each other before this season. That only
            happens when no other pairing of the round was possible.
          </Note>
        ) : null}
      </main>
    </>
  );
}
