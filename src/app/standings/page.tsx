import type { Metadata } from "next";
import { Pawn } from "@/components/pawn";
import { SiteHeader } from "@/components/site-header";
import { StandingsTable } from "@/components/standings-table";
import {
  getActiveSeason,
  getRoster,
  getSeasonHistory,
  seasonParticipants,
  toPlayerInputs,
} from "@/lib/club/queries";
import { currentRole } from "@/lib/officer/session";
import { computeStandings, playerHistory } from "@/lib/swiss";

export const metadata: Metadata = { title: "Standings" };

export default async function StandingsPage() {
  const [role, season] = await Promise.all([currentRole(), getActiveSeason()]);

  if (!season) {
    return (
      <>
        <SiteHeader role={role} currentPath="/standings" />
        <main className="mx-auto max-w-5xl px-6 py-12 sm:py-20">
          <h1 className="text-3xl sm:text-4xl">Standings</h1>
          <EmptyState>
            No season is running yet, so there is nothing to rank. An officer can
            start one from the round screen.
          </EmptyState>
        </main>
      </>
    );
  }

  const [roster, history] = await Promise.all([
    getRoster(),
    getSeasonHistory(season.id),
  ]);

  const participants = seasonParticipants(roster, history.matchupViews);
  const standings = computeStandings(toPlayerInputs(participants), history.matchups);
  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const gradeById = new Map(roster.map((p) => [p.id, p.grade]));
  const historyByPlayer = playerHistory(history.matchups);
  const gamesByPlayer = new Map(
    [...historyByPlayer].map(([id, entry]) => [id, entry.games]),
  );
  const roundsPlayed = history.rounds.filter((round) =>
    history.matchupViews.some(
      (view) =>
        view.pairing.round_id === round.id &&
        view.games.some((game) => game.result !== "pending"),
    ),
  ).length;

  return (
    <>
      <SiteHeader role={role} currentPath="/standings" />

      <main className="mx-auto max-w-5xl px-6 py-10 sm:py-16">
        <p className="label">{season.name}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">Standings</h1>
        <p className="text-muted mt-3 text-sm">
          After {roundsPlayed} {roundsPlayed === 1 ? "round" : "rounds"}. Ordered by
          score, then Buchholz, then Sonneborn-Berger.
        </p>

        {standings.length === 0 ? (
          <EmptyState>
            No games have been played this season yet. Once the first round is
            paired and results are in, the table fills in here.
          </EmptyState>
        ) : (
          <div className="mt-10">
            <StandingsTable
              rows={standings}
              nameById={nameById}
              gradeById={gradeById}
              gamesByPlayer={gamesByPlayer}
            />
          </div>
        )}

        <p className="text-faint mt-8 max-w-prose text-xs leading-relaxed">
          Score is game points: a matchup of three games ending 2&ndash;1 is worth
          two. A bye is worth a whole matchup, so sitting out costs nothing
          against the players who won theirs. Byes and forfeits are never played,
          so they count towards neither tiebreak nor games played. Players who
          join mid-season enter on zero — compare scores alongside games played.
        </p>

        <p className="text-faint mt-4 max-w-prose text-xs leading-relaxed">
          These standings count the rounds recorded on this site. The club played
          earlier rounds of the Inaugural Games before the site existed, and those
          survive only as totals on the printed sheets — a total cannot be turned
          back into the games behind it, and both tiebreaks are built from
          individual games, so entering one would produce figures that reconcile
          with nothing. Those rounds stay on the club&rsquo;s own sheets.
        </p>
      </main>
    </>
  );
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="mt-10 flex items-start gap-4 border-t pt-8"
      style={{ borderColor: "var(--rule)" }}
    >
      <Pawn className="text-faint mt-0.5 h-5 w-auto shrink-0" />
      <p className="text-muted max-w-prose text-sm leading-relaxed">{children}</p>
    </div>
  );
}
