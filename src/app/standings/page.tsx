import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Pawn } from "@/components/pawn";
import { SiteHeader } from "@/components/site-header";
import {
  getActiveSeason,
  getRoster,
  getSeasonHistory,
  getViewer,
  seasonParticipants,
  toPlayerInputs,
} from "@/lib/club/queries";
import { computeStandings } from "@/lib/swiss";

export const metadata: Metadata = { title: "Standings" };

/** 1.5 rather than 1.50, and "½" where a half point reads more naturally. */
function formatPoints(value: number): string {
  const whole = Math.floor(value);
  const hasHalf = value - whole === 0.5;
  if (hasHalf) return whole === 0 ? "½" : `${whole}½`;
  return String(value);
}

export default async function StandingsPage() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");

  const season = await getActiveSeason();

  if (!season) {
    return (
      <>
        <SiteHeader isOfficer={viewer.isOfficer} currentPath="/standings" />
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
  const nameById = new Map(roster.map((p) => [p.id, p.full_name || p.email]));
  const roundsPlayed = history.rounds.filter((r) => r.status === "completed").length;

  return (
    <>
      <SiteHeader isOfficer={viewer.isOfficer} currentPath="/standings" />

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
          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[36rem] border-collapse text-sm">
              <thead>
                <tr
                  className="border-b"
                  style={{ borderColor: "var(--rule-strong)" }}
                >
                  <th className="label py-3 pr-3 text-left font-normal" scope="col">
                    #
                  </th>
                  <th className="label py-3 pr-6 text-left font-normal" scope="col">
                    Player
                  </th>
                  <th
                    className="label py-3 pr-6 text-right font-normal"
                    scope="col"
                    data-numeric
                  >
                    Score
                  </th>
                  <th
                    className="label py-3 pr-6 text-right font-normal"
                    scope="col"
                    data-numeric
                  >
                    Played
                  </th>
                  <th
                    className="label py-3 pr-6 text-right font-normal"
                    scope="col"
                    data-numeric
                  >
                    W–D–L
                  </th>
                  <th
                    className="label py-3 pr-6 text-right font-normal"
                    scope="col"
                    data-numeric
                    title="Sum of opponents' scores"
                  >
                    Buch.
                  </th>
                  <th
                    className="label py-3 text-right font-normal"
                    scope="col"
                    data-numeric
                    title="Sonneborn-Berger"
                  >
                    S-B
                  </th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => {
                  const isViewer = row.playerId === viewer.profile.id;
                  return (
                    <tr
                      key={row.playerId}
                      className="border-b"
                      style={{
                        borderColor: "var(--rule)",
                        backgroundColor: isViewer
                          ? "var(--color-cream-deep)"
                          : undefined,
                      }}
                    >
                      <td className="text-faint py-3 pr-3" data-numeric>
                        {row.rank}
                      </td>
                      <td className="py-3 pr-6">
                        {nameById.get(row.playerId) ?? "Unknown player"}
                        {row.byes > 0 ? (
                          <span className="text-faint ml-2 text-xs">
                            {row.byes === 1 ? "bye" : `${row.byes} byes`}
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 pr-6 text-right font-medium" data-numeric>
                        {formatPoints(row.score)}
                      </td>
                      <td className="text-muted py-3 pr-6 text-right" data-numeric>
                        {row.gamesPlayed}
                      </td>
                      <td className="text-muted py-3 pr-6 text-right" data-numeric>
                        {row.wins}–{row.draws}–{row.losses}
                      </td>
                      <td className="text-faint py-3 pr-6 text-right" data-numeric>
                        {formatPoints(row.buchholz)}
                      </td>
                      <td className="text-faint py-3 text-right" data-numeric>
                        {formatPoints(row.sonnebornBerger)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
