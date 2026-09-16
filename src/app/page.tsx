import Link from "next/link";
import { Suspense } from "react";
import { LeaderMark } from "@/components/chess-motion";
import { ChevronRight, SearchIcon } from "@/components/icons";
import { MatchCard } from "@/components/match-card";
import { ListSkeleton, MatchCardsSkeleton } from "@/components/skeletons";
import {
  CountUp,
  MoreLink,
  RoundStatusTag,
  SectionHeading,
  formatDate,
} from "@/components/ui";
import { Wordmark } from "@/components/wordmark";
import { CLUB_INFO } from "@/lib/club/info";
import { getSeasonSnapshot } from "@/lib/club/snapshot";
import { getTerms } from "@/lib/club/wording";
import { currentRole, type ClubRole } from "@/lib/officer/session";
import { ordinal } from "@/lib/terms";

/** How many players the home page previews before pointing at the full table. */
const TOP_PLAYERS = 5;

/**
 * The home page answers the three things people arrive wanting: who is top,
 * what happened at the last meeting, and what this club is.
 *
 * It used to hold one button and a paragraph about tiebreaks. NN/g's homepage
 * guidance is to show real content rather than describe it, and to give the
 * main tasks visible weight — so the table and the latest round are here in
 * miniature, each with one clear way to see the rest.
 *
 * Only the role is read before rendering — a cookie, not a query — so the
 * welcome and the three steps appear at once and the season streams in between
 * them.
 */
export default async function HomePage() {
  const role = await currentRole();

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
      <section>
        <h1 className="text-4xl text-balance sm:text-5xl">
          <Wordmark /> Chess Club
        </h1>
        <p className="text-muted mt-4 max-w-2xl text-lg leading-relaxed">
          {CLUB_INFO.about}
        </p>

        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/standings" className="btn-primary">
            See the standings
          </Link>
          <Link href="/players" className="btn">
            <SearchIcon className="size-4" />
            Find a player
          </Link>
        </div>
      </section>

      {role ? <StaffCard role={role} /> : null}

      <Suspense fallback={<SeasonSkeleton />}>
        <SeasonSection />
      </Suspense>

      <HowASeasonWorks />
    </main>
  );
}

function StaffCard({ role }: { role: ClubRole }) {
  return (
    <Link
      href={role === "officer" ? "/officer" : "/arbiter"}
      className="card-link mt-10 flex items-center justify-between gap-4 p-4 sm:p-5"
    >
      <span>
        <span className="block font-semibold">
          {role === "officer" ? "Officer tools" : "Report results"}
        </span>
        <span className="text-muted mt-0.5 block text-sm">
          {role === "officer"
            ? "Start a round, pair players, enter results and manage the roster."
            : "Enter the results of this round's games."}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0" />
    </Link>
  );
}

/** Where the season stands: the top of the table, and the latest round. */
async function SeasonSection() {
  const [snapshot, terms] = await Promise.all([getSeasonSnapshot(), getTerms()]);

  if (!snapshot) {
    return (
      <p className="card text-muted mt-12 max-w-2xl p-5">
        No season is running yet. Once officers start one, the standings and
        results appear here.
      </p>
    );
  }

  const latestRound =
    [...snapshot.history.rounds]
      .sort((a, b) => b.round_number - a.round_number)
      .find((round) =>
        snapshot.history.matchupViews.some((v) => v.pairing.round_id === round.id),
      ) ?? null;
  const latestMatches = latestRound
    ? snapshot.history.matchupViews.filter(
        (v) => v.pairing.round_id === latestRound.id,
      )
    : [];

  return (
    <>
      <p className="mt-8 flex flex-wrap items-center gap-2 text-sm">
        <span className="tag">{snapshot.season.name}</span>
        <span className="tag">
          {snapshot.roundsPlayed} {snapshot.roundsPlayed === 1 ? "round" : "rounds"}{" "}
          played
        </span>
        <span className="tag">
          {snapshot.standings.length}{" "}
          {snapshot.standings.length === 1 ? "player" : "players"}
        </span>
      </p>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8">
        <section aria-labelledby="top-heading">
          <SectionHeading id="top-heading">Top of the table</SectionHeading>
          {snapshot.standings.length === 0 ? (
            <p className="card text-muted mt-4 p-5">
              No results yet. The table fills in once the first games are
              reported.
            </p>
          ) : (
            <ol className="card mt-4 p-2">
              {snapshot.standings.slice(0, TOP_PLAYERS).map((row, index) => (
                <li
                  key={row.playerId}
                  className="reveal"
                  style={{ "--i": index } as React.CSSProperties}
                >
                  <Link href={`/players/${row.playerId}`} className="row-link mx-0 px-3">
                    <span
                      className={`flex w-12 shrink-0 items-center gap-1.5 text-sm tabular-nums ${row.rank <= 3 ? "font-semibold" : "text-muted"}`}
                    >
                      {ordinal(row.rank)}
                      {row.rank === 1 ? <LeaderMark /> : null}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {snapshot.nameById.get(row.playerId)}
                    </span>
                    <span className="shrink-0 text-right tabular-nums">
                      <CountUp value={row.score} className="font-semibold" />
                      <span className="text-muted text-sm">
                        {" "}
                        {terms.points.toLowerCase()}
                      </span>
                    </span>
                    <ChevronRight className="text-faint size-4 shrink-0" />
                  </Link>
                </li>
              ))}
            </ol>
          )}
          <MoreLink href="/standings">See the full standings</MoreLink>
        </section>

        <section aria-labelledby="latest-heading">
          <SectionHeading
            id="latest-heading"
            aside={
              latestRound ? (
                <span className="flex items-center gap-2">
                  {formatDate(latestRound.played_on, "short")}
                  <RoundStatusTag status={latestRound.status} />
                </span>
              ) : null
            }
          >
            {latestRound ? `Round ${latestRound.round_number}` : "Latest round"}
          </SectionHeading>
          {latestRound ? (
            <div className="mt-4 space-y-3">
              {latestMatches.slice(0, 4).map((view, index) => (
                <MatchCard
                  key={view.pairing.id}
                  revealIndex={index}
                  view={view}
                  nameById={snapshot.nameById}
                  terms={terms}
                  tracksColors={latestRound.tracks_colors}
                  showGames={false}
                />
              ))}
              {latestMatches.length > 4 ? (
                <p className="text-muted text-sm">
                  and {latestMatches.length - 4} more {terms.matches}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="card text-muted mt-4 p-5">No round has been paired yet.</p>
          )}
          <MoreLink href="/results">See every result</MoreLink>
        </section>
      </div>
    </>
  );
}

function SeasonSkeleton() {
  return (
    <div
      className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-8"
      aria-hidden
    >
      <ListSkeleton rows={5} />
      <MatchCardsSkeleton count={2} />
    </div>
  );
}

/** Three steps, the same for every visitor, so they never wait on the season. */
function HowASeasonWorks() {
  const steps = [
    {
      title: "Every meeting is a round",
      body: "Come when you can. Missing a week does not drop you from the table.",
    },
    {
      title: "Everyone gets a match",
      body: "You play three games against one opponent, usually someone on similar points.",
    },
    {
      title: "Each game is a point",
      body: "A win is 1 point and a draw is ½. Most points at the end of the season wins.",
    },
  ];

  return (
    <section aria-labelledby="how-heading" className="mt-16">
      <SectionHeading id="how-heading">How a season works</SectionHeading>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="card reveal p-5"
            style={{ "--i": index } as React.CSSProperties}
          >
            <span className="bg-ink text-cream flex size-8 items-center justify-center rounded-full text-sm font-semibold">
              {index + 1}
            </span>
            <h3 className="mt-3 text-lg">{step.title}</h3>
            <p className="text-muted mt-1 text-[0.9375rem] leading-relaxed">
              {step.body}
            </p>
          </li>
        ))}
      </ol>
      <MoreLink href="/about">About the club and how to join</MoreLink>
    </section>
  );
}
