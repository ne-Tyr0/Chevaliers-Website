import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatMatchupScore } from "@/components/matchup-games";
import { ReviewBanner, ReviewGate } from "@/components/review-gate";
import { SiteHeader } from "@/components/site-header";
import { setRoundColorTracking } from "@/lib/club/actions";
import { getRound, getRoundMatchups, getRoster } from "@/lib/club/queries";
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

  const [matchups, roster, reviewUntil] = await Promise.all([
    getRoundMatchups(roundId),
    getRoster(),
    reviewExpiresAt(),
  ]);

  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const returnTo = `/officer/round/${roundId}`;
  const closed = round.status === "completed";
  const editable = !closed || reviewUntil !== null;
  const outstanding = matchups.reduce(
    (sum, view) => sum + view.games.filter((g) => g.result === "pending").length,
    0,
  );

  return (
    <>
      <SiteHeader role={role} currentPath="/officer" />

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-16">
        <Link href="/officer" className="text-faint text-sm hover:text-ink">
          ← Back to officer tools
        </Link>

        <p className="label mt-6">{round.status.replace("_", " ")}</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Round {round.round_number}</h1>
        <p className="text-muted mt-3 text-sm">
          {formatDate(round.played_on)} · {matchups.length}{" "}
          {matchups.length === 1 ? "matchup" : "matchups"}
          {outstanding > 0 ? ` · ${outstanding} unreported` : ""}
          {round.tracks_colors ? "" : " · colours not tracked"}
        </p>

        {typeof error === "string" ? (
          <p
            role="alert"
            className="mt-6 border-l-2 py-1 pl-4 text-sm"
            style={{ borderColor: "var(--color-ink)" }}
          >
            {error}
          </p>
        ) : null}

        {closed && reviewUntil === null ? (
          <ReviewGate returnTo={returnTo} roundNumber={round.round_number} />
        ) : null}
        {closed && reviewUntil !== null ? (
          <ReviewBanner returnTo={returnTo} expiresAt={reviewUntil} />
        ) : null}

        {matchups.length === 0 ? (
          <p className="text-muted mt-8 text-sm">
            This round has no matchups.
          </p>
        ) : (
          <ul className="mt-8">
            {matchups.map((view) => {
              const isBye = view.pairing.player_b_id === null;
              const left = view.games.filter((g) => g.result === "pending").length;

              return (
                <li
                  key={view.pairing.id}
                  className="border-b"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <Link
                    href={`/matchup/${view.pairing.id}`}
                    className="flex items-center gap-4 py-3 text-sm transition-colors hover:bg-cream-deep"
                  >
                    <span className="text-faint w-6" data-numeric>
                      {view.pairing.board_number}
                    </span>
                    <span className="min-w-0 flex-1">
                      {nameById.get(view.pairing.player_a_id)}
                      {isBye ? (
                        <span className="text-faint"> — bye</span>
                      ) : (
                        <>
                          <span className="text-faint mx-2">v</span>
                          {nameById.get(view.pairing.player_b_id!)}
                        </>
                      )}
                    </span>
                    <span className="tabular-nums whitespace-nowrap">
                      {isBye ? (
                        <span className="text-faint text-xs">—</span>
                      ) : (
                        formatMatchupScore(view)
                      )}
                    </span>
                    <span className="text-faint w-20 text-right text-xs">
                      {isBye ? "" : left === 0 ? "complete" : `${left} to go`}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {!closed ? (
          <form
            action={setRoundColorTracking}
            className="mt-10 border-t pt-6"
            style={{ borderColor: "var(--rule)" }}
          >
            <input type="hidden" name="roundId" value={round.id} />
            <input type="hidden" name="returnTo" value={returnTo} />
            <input
              type="hidden"
              name="tracks"
              value={round.tracks_colors ? "false" : "true"}
            />
            <h2 className="label">Colours</h2>
            <p className="text-faint mt-2 max-w-prose text-xs leading-relaxed">
              {round.tracks_colors
                ? "This round asks who had White in each game. Turn that off for a round being entered from paper, where nobody wrote it down."
                : "This round does not ask who had White. Anything already recorded is kept, just not asked for."}
            </p>
            <button
              type="submit"
              className="text-muted mt-3 cursor-pointer border px-4 py-2 text-sm transition-colors hover:text-ink"
              style={{ borderColor: "var(--rule-strong)" }}
            >
              {round.tracks_colors ? "Stop recording colours" : "Record colours"}
            </button>
          </form>
        ) : null}

        {closed && !editable ? (
          <p className="text-faint mt-8 max-w-prose text-xs leading-relaxed">
            Pairings are never editable once a round has been played — changing
            who faced whom would invent games nobody sat down for. Only results
            and colours can be corrected.
          </p>
        ) : null}
      </main>
    </>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
