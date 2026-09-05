import Link from "next/link";
import { Pawn } from "@/components/pawn";
import { SiteHeader } from "@/components/site-header";
import { Wordmark } from "@/components/wordmark";
import { getActiveSeason, getSeasonHistory } from "@/lib/club/queries";
import { currentRole } from "@/lib/officer/session";

export default async function HomePage() {
  const [role, season] = await Promise.all([currentRole(), getActiveSeason()]);
  const history = season ? await getSeasonHistory(season.id) : null;
  const roundsPlayed =
    history?.rounds.filter((round) =>
      history.matchupViews.some(
        (view) =>
          view.pairing.round_id === round.id &&
          view.games.some((game) => game.result !== "pending"),
      ),
    ).length ?? 0;

  return (
    <>
      <SiteHeader role={role} currentPath="/" />

      <main className="mx-auto max-w-5xl px-6 py-20">
        <p className="label">School chess club</p>
        <h1 className="mt-4 text-5xl text-balance">
          <Wordmark /> Chess Club
        </h1>

        {season ? (
          <p className="text-muted mt-6 max-w-prose leading-relaxed">
            {season.name} is under way — {roundsPlayed}{" "}
            {roundsPlayed === 1 ? "round" : "rounds"} played so far. The season runs
            as one continuous Swiss event, so every club meeting is a round and
            players can join late or miss a week without falling out of the
            standings.
          </p>
        ) : (
          <p className="text-muted mt-6 max-w-prose leading-relaxed">
            No season is running yet. An officer needs to start one before pairings
            can be made.
          </p>
        )}

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/standings"
            className="border px-5 py-2.5 text-sm transition-colors hover:bg-ink hover:text-cream"
            style={{ borderColor: "var(--color-ink)" }}
          >
            View standings
          </Link>
          {role === "officer" ? (
            <Link
              href="/officer"
              className="text-muted border px-5 py-2.5 text-sm transition-colors hover:text-ink"
              style={{ borderColor: "var(--rule-strong)" }}
            >
              Run a round
            </Link>
          ) : null}
        </div>

        <div
          className="mt-20 flex items-start gap-4 border-t pt-8"
          style={{ borderColor: "var(--rule)" }}
        >
          <Pawn className="text-faint mt-0.5 h-5 w-auto shrink-0" />
          <p className="text-faint max-w-prose text-sm leading-relaxed">
            Standings are ordered by score, then Buchholz, then Sonneborn-Berger.
            Because attendance varies, games played is shown next to every score —
            points alone are misleading when players have sat out different numbers
            of rounds.
          </p>
        </div>
      </main>
    </>
  );
}
