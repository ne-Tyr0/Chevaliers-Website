import type { Metadata } from "next";
import type { PlayerRow } from "@/lib/supabase/database.types";
import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MatchCard } from "@/components/match-card";
import { MatchCardsSkeleton, StatTilesSkeleton } from "@/components/skeletons";
import {
  CountUp,
  EmptyState,
  MoreLink,
  PageHeader,
  SectionHeading,
  WordingToggle,
  formatDate,
} from "@/components/ui";
import { formatSchoolYear, getOfficerYears } from "@/lib/club/officers";
import { getRoster } from "@/lib/club/queries";
import { getSeasonSnapshot } from "@/lib/club/snapshot";
import { getTerms } from "@/lib/club/wording";
import { formatPoints, ordinal } from "@/lib/terms";

export async function generateMetadata({
  params,
}: PageProps<"/players/[playerId]">): Promise<Metadata> {
  const { playerId } = await params;
  const player = (await getRoster()).find((p) => p.id === playerId);
  return { title: player?.full_name ?? "Player" };
}

/**
 * One player's season: where they stand, and every match they have played.
 *
 * This replaces the hover card that used to be the only way to see a player's
 * record. Hover does not exist on a phone, and NN/g's guidance is that nothing
 * people need should live only in a tooltip.
 */
export default async function PlayerPage({
  params,
}: PageProps<"/players/[playerId]">) {
  const { playerId } = await params;
  // The roster alone names the page, and it is one quick query; the season,
  // which is the heavy part, streams in underneath.
  const player = (await getRoster()).find((p) => p.id === playerId);
  if (!player) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
      <PageHeader
        crumbs={[{ href: "/players", label: "Players" }]}
        eyebrow={
          [player.grade, player.is_active ? null : "No longer playing"]
            .filter(Boolean)
            .join(" · ") || undefined
        }
        title={player.full_name}
      />
      <Suspense fallback={null}>
        <PlayerPositions player={player} />
      </Suspense>
      <Suspense
        fallback={
          <>
            <StatTilesSkeleton />
            <MatchCardsSkeleton count={2} />
          </>
        }
      >
        <PlayerSeason player={player} />
      </Suspense>
    </main>
  );
}

/** Any club position this player holds, in the most recent year entered. */
async function PlayerPositions({ player }: { player: PlayerRow }) {
  const { years } = await getOfficerYears();
  const latestYear = years[0];
  const positions =
    latestYear?.officers.filter((officer) => officer.player_id === player.id) ?? [];
  if (positions.length === 0 || !latestYear) return null;

  return (
    <p className="mt-3 flex flex-wrap items-center gap-2">
      {positions.map((officer) => (
        <span key={officer.id} className="tag tag-strong">
          {officer.position}, {formatSchoolYear(latestYear.schoolYear)}
        </span>
      ))}
      <Link
        href="/players/officers"
        className="link inline-flex min-h-9 items-center text-sm"
      >
        All officers
      </Link>
    </p>
  );
}

async function PlayerSeason({ player }: { player: PlayerRow }) {
  const [snapshot, terms] = await Promise.all([getSeasonSnapshot(), getTerms()]);

  const row = snapshot?.rowById.get(player.id) ?? null;
  const games = snapshot?.gamesByPlayer.get(player.id) ?? [];
  const whites = games.filter((g) => g.color === "white").length;
  const blacks = games.filter((g) => g.color === "black").length;
  const returnTo = `/players/${player.id}`;

  const rounds = snapshot
    ? snapshot.history.rounds
        .slice()
        .sort((a, b) => b.round_number - a.round_number)
        .map((round) => ({
          round,
          view: snapshot.history.matchupViews.find(
            (v) =>
              v.pairing.round_id === round.id &&
              (v.pairing.player_a_id === player.id ||
                v.pairing.player_b_id === player.id),
          ),
        }))
        .filter(
          (entry): entry is { round: typeof entry.round; view: NonNullable<typeof entry.view> } =>
            entry.view !== undefined,
        )
    : [];

  return (
    <>
      {!row ? (
          <EmptyState action={<MoreLink href="/players">Back to all players</MoreLink>}>
            {player.full_name} has not played this season yet. Their games will
            show here after their first round.
          </EmptyState>
        ) : (
          <>
            <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                index={0}
                label="Place"
                value={ordinal(row.rank)}
                detail={`of ${snapshot!.standings.length}`}
              />
              <Stat index={1} label={terms.points} value={<CountUp value={row.score} />} />
              <Stat
                index={2}
                label="Games played"
                value={<CountUp value={row.gamesPlayed} />}
              />
              <Stat
                index={3}
                label="Won · Drawn · Lost"
                value={`${row.wins} · ${row.draws} · ${row.losses}`}
              />
            </dl>

            <details className="card group mt-4">
              <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 font-medium">
                More numbers
                <span className="btn-quiet pointer-events-none">
                  <span className="group-open:hidden">Show</span>
                  <span className="hidden group-open:inline">Hide</span>
                </span>
              </summary>
              <dl
                className="grid gap-x-8 gap-y-4 border-t px-5 py-4 sm:grid-cols-2"
                style={{ borderColor: "var(--rule)" }}
              >
                <Detail
                  label={terms.buchholz}
                  value={formatPoints(row.buchholz)}
                  hint={terms.buchholzHint}
                />
                <Detail
                  label={terms.sonnebornBerger}
                  value={formatPoints(row.sonnebornBerger)}
                  hint={terms.sonnebornBergerHint}
                />
                <Detail
                  label="Played as White / Black"
                  value={whites + blacks === 0 ? "Not recorded" : `${whites} / ${blacks}`}
                  hint="Games where colours were noted down."
                />
                {row.byes > 0 || row.forfeitWins + row.forfeitLosses > 0 ? (
                  <Detail
                    label={terms.chess ? "Byes and forfeits" : "Rounds and games not played"}
                    value={[
                      row.byes > 0 ? terms.byes(row.byes) : null,
                      row.forfeitWins > 0 ? `${row.forfeitWins} ${terms.outcome("forfeit_win")}` : null,
                      row.forfeitLosses > 0 ? `${row.forfeitLosses} ${terms.outcome("forfeit_loss")}` : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                    hint={
                      terms.chess
                        ? "Scored, but not counted in games played or tiebreaks."
                        : "These count for points, but not for games played."
                    }
                  />
                ) : null}
              </dl>
            </details>

            <section aria-labelledby="games-heading" className="mt-12">
              <SectionHeading id="games-heading">This season&rsquo;s games</SectionHeading>
              <WordingToggle terms={terms} returnTo={returnTo} className="mt-3" />
              <div className="mt-5 space-y-8">
                {rounds.map(({ round, view }) => (
                  <div key={round.id}>
                    <h3 className="text-lg">
                      Round {round.round_number}
                      <span className="text-muted ml-2 font-sans text-sm font-normal">
                        {formatDate(round.played_on)}
                      </span>
                    </h3>
                    <div className="mt-2">
                      <MatchCard
                        view={view}
                        nameById={snapshot!.nameById}
                        terms={terms}
                        tracksColors={round.tracks_colors}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
        </>
      )}
    </>
  );
}

function Stat({
  index,
  label,
  value,
  detail,
}: {
  index: number;
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="card reveal p-4" style={{ "--i": index } as React.CSSProperties}>
      <dt className="label">{label}</dt>
      <dd className="mt-1">
        <span className="font-display text-2xl font-semibold tabular-nums">{value}</span>
        {detail ? <span className="text-muted ml-1.5 text-sm">{detail}</span> : null}
      </dd>
    </div>
  );
}

function Detail({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <dt className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums">{value}</span>
      </dt>
      <dd className="text-muted mt-1 text-sm leading-relaxed">{hint}</dd>
    </div>
  );
}
