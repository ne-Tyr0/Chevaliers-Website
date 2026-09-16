import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TableSkeleton } from "@/components/skeletons";
import { StandingsTable } from "@/components/standings-table";
import { EmptyState, MoreLink, PageHeader, WordingToggle } from "@/components/ui";
import { getSeasonSnapshot } from "@/lib/club/snapshot";
import { getTerms } from "@/lib/club/wording";

export const metadata: Metadata = { title: "Standings" };

/**
 * The page frame renders without waiting for anything, and the table streams
 * in behind it.
 *
 * The database is a round trip away and this page is never cached, so waiting
 * for it before sending anything left the screen blank. Sending the heading
 * first means a tab opens immediately, with a table-shaped placeholder where
 * the table is about to be.
 */
export default function StandingsPage() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <PageHeader
        title="Standings"
        description="Who is ahead this season. The most points is top; select a name to see that player&rsquo;s games."
      />
      <Suspense fallback={<TableSkeleton />}>
        <StandingsBody />
      </Suspense>
    </main>
  );
}

async function StandingsBody() {
  const [snapshot, terms] = await Promise.all([getSeasonSnapshot(), getTerms()]);

  if (!snapshot) {
    return (
      <EmptyState action={<MoreLink href="/about">How a season works</MoreLink>}>
        No season is running yet, so there is nobody to rank. The table appears
        here once officers start one.
      </EmptyState>
    );
  }

  const { season, standings, roundsPlayed } = snapshot;
  const gradeById = new Map(snapshot.roster.map((p) => [p.id, p.grade]));

  return (
    <>
      <p className="text-muted mt-4">
        {season.name} · after {roundsPlayed}{" "}
        {roundsPlayed === 1 ? "round" : "rounds"}
      </p>

      <WordingToggle terms={terms} returnTo="/standings" className="mt-4" />

      {standings.length === 0 ? (
        <EmptyState action={<MoreLink href="/results">See the pairings</MoreLink>}>
          No games have been reported this season yet. The table fills in as
          soon as the first results are in.
        </EmptyState>
      ) : (
        <div className="mt-6">
          <StandingsTable
            rows={standings}
            nameById={snapshot.nameById}
            gradeById={gradeById}
            terms={terms}
          />
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="text-lg">How the order is decided</h2>
          <p className="text-muted mt-2 text-[0.9375rem] leading-relaxed">
            {terms.chess ? (
              <>
                Ordered by score, then Buchholz, then Sonneborn-Berger. Score is
                game points, so a 2–1 matchup is worth two.
              </>
            ) : (
              <>
                Most points first. Each game won is a point and each draw is
                half. Players level on points are separated by who had the
                tougher opponents.
              </>
            )}
          </p>
          <MoreLink href="/about#scoring">The full rules</MoreLink>
        </div>
        <div className="card p-5">
          <h2 className="text-lg">Compare games played too</h2>
          <p className="text-muted mt-2 text-[0.9375rem] leading-relaxed">
            Not everyone comes to every meeting, and players who join partway
            through start on zero. Check the{" "}
            <strong className="text-ink font-medium">{terms.gamesPlayed}</strong>{" "}
            column alongside points.
          </p>
          <p className="text-muted mt-3 text-sm leading-relaxed">
            Rounds played before this site existed are not included.{" "}
            <Link href="/about#earlier-rounds" className="link">
              Why
            </Link>
          </p>
        </div>
      </div>
    </>
  );
}
