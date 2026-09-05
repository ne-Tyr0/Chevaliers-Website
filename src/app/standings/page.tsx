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
import { isOfficer } from "@/lib/officer/session";
import { computeStandings } from "@/lib/swiss";

export const metadata: Metadata = { title: "Standings" };

export default async function StandingsPage() {
  const [officer, season] = await Promise.all([isOfficer(), getActiveSeason()]);

  if (!season) {
    return (
      <>
        <SiteHeader isOfficer={officer} currentPath="/standings" />
        <main className="mx-auto max-w-5xl px-6 py-20">
          <h1 className="text-4xl">Standings</h1>
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

  const participants = seasonParticipants(roster, history.allPairings);
  const standings = computeStandings(toPlayerInputs(participants), history.completed);
  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const roundsPlayed = history.rounds.filter((round) =>
    history.allPairings.some(
      (p) => p.round_id === round.id && p.result !== "pending",
    ),
  ).length;

  return (
    <>
      <SiteHeader isOfficer={officer} currentPath="/standings" />

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="label">{season.name}</p>
        <h1 className="mt-3 text-4xl">Standings</h1>
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
            <StandingsTable rows={standings} nameById={nameById} />
          </div>
        )}

        <p className="text-faint mt-8 max-w-prose text-xs leading-relaxed">
          A bye is worth a full point but counts as a game against an opponent with
          no score, so it never inflates either tiebreak. Players who join
          mid-season enter on zero and are ranked on the same basis as everyone
          else — compare scores alongside games played.
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
