import type { Metadata } from "next";
import { MatchCard } from "@/components/match-card";
import {
  EmptyState,
  MoreLink,
  PageHeader,
  RoundStatusTag,
  SectionHeading,
  WordingToggle,
  formatDate,
} from "@/components/ui";
import { getSeasonSnapshot } from "@/lib/club/snapshot";
import { getTerms } from "@/lib/club/wording";

export const metadata: Metadata = { title: "Results" };

export default async function ResultsPage() {
  const [snapshot, terms] = await Promise.all([
    getSeasonSnapshot(),
    getTerms(),
  ]);

  if (!snapshot) {
    return (
      <>
        <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
          <PageHeader title={terms.resultsTitle} />
          <EmptyState action={<MoreLink href="/about">How a season works</MoreLink>}>
            No season is running yet. Once officers start one and pair the first
            round, every {terms.match} appears here.
          </EmptyState>
        </main>
      </>
    );
  }

  const { history, nameById, season } = snapshot;

  // Newest round first: the last meeting is the one people came to look at.
  const rounds = history.rounds
    .slice()
    .sort((a, b) => b.round_number - a.round_number)
    .map((round) => ({
      round,
      matches: history.matchupViews.filter((v) => v.pairing.round_id === round.id),
    }))
    .filter((entry) => entry.matches.length > 0);

  return (
    <>
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <PageHeader
          eyebrow={season.name}
          title={terms.resultsTitle}
          description={`Every ${terms.match} of the season, newest round first. Each ${terms.match} is three games against the same opponent.`}
        />

        <WordingToggle terms={terms} returnTo="/results" className="mt-6" />

        {rounds.length === 0 ? (
          <EmptyState>
            No rounds have been paired yet. They appear here as soon as officers
            pair the first one.
          </EmptyState>
        ) : (
          <>
            {rounds.length > 1 ? (
              <nav aria-label="Jump to a round" className="mt-8">
                <p className="label">Jump to a round</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {rounds.map(({ round }) => (
                    <li key={round.id}>
                      <a href={`#round-${round.round_number}`} className="btn btn-sm">
                        Round {round.round_number}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <div className="mt-10 space-y-14">
              {rounds.map(({ round, matches }) => (
                <section
                  key={round.id}
                  id={`round-${round.round_number}`}
                  aria-labelledby={`round-${round.round_number}-heading`}
                  className="scroll-mt-6"
                >
                  <SectionHeading
                    id={`round-${round.round_number}-heading`}
                    aside={
                      <span className="flex flex-wrap items-center gap-2">
                        {formatDate(round.played_on)}
                        <RoundStatusTag status={round.status} />
                      </span>
                    }
                  >
                    Round {round.round_number}
                  </SectionHeading>
                  {!round.tracks_colors ? (
                    <p className="text-muted mt-2 text-sm">
                      Nobody noted who had White in this round, so colours are
                      not shown. Scores are unaffected.
                    </p>
                  ) : null}

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {matches.map((view, index) => (
                      <MatchCard
                        key={view.pairing.id}
                        revealIndex={index}
                        view={view}
                        nameById={nameById}
                        terms={terms}
                        tracksColors={round.tracks_colors}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
