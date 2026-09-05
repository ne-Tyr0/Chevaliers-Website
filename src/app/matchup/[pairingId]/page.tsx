import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formatMatchupScore, MatchupGames } from "@/components/matchup-games";
import { SiteHeader } from "@/components/site-header";
import { getMatchup, getRoster } from "@/lib/club/queries";
import { currentRole } from "@/lib/officer/session";

export const metadata: Metadata = { title: "Matchup" };

export default async function MatchupPage({
  params,
  searchParams,
}: PageProps<"/matchup/[pairingId]">) {
  const role = await currentRole();
  if (!role) redirect("/officer");

  const { pairingId } = await params;
  const { error } = await searchParams;

  const [view, roster] = await Promise.all([getMatchup(pairingId), getRoster()]);
  if (!view) notFound();

  const nameById = new Map(roster.map((p) => [p.id, p.full_name]));
  const nameA = nameById.get(view.pairing.player_a_id) ?? "Unknown player";
  const nameB = view.pairing.player_b_id
    ? (nameById.get(view.pairing.player_b_id) ?? "Unknown player")
    : "Bye";

  const home = role === "officer" ? "/officer" : "/arbiter";
  const returnTo = `/matchup/${pairingId}`;
  const outstanding = view.games.filter((g) => g.result === "pending").length;

  return (
    <>
      <SiteHeader role={role} currentPath="/matchup" />

      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href={home} className="text-faint text-sm hover:text-ink">
          ← Back to {role === "officer" ? "officer tools" : "arbiter tools"}
        </Link>

        <p className="label mt-6">Board {view.pairing.board_number}</p>
        <h1 className="mt-2 text-3xl text-balance">
          {nameA} <span className="text-faint">v</span> {nameB}
        </h1>

        {view.pairing.player_b_id ? (
          <p className="text-muted mt-3 text-sm tabular-nums">
            {formatMatchupScore(view)}
            {outstanding > 0 ? (
              <span className="text-faint">
                {" "}
                · {outstanding} of {view.games.length} still to report
              </span>
            ) : (
              <span className="text-faint"> · complete</span>
            )}
          </p>
        ) : null}

        {typeof error === "string" ? (
          <p
            role="alert"
            className="mt-6 border-l-2 py-1 pl-4 text-sm"
            style={{ borderColor: "var(--color-ink)" }}
          >
            {error}
          </p>
        ) : null}

        <MatchupGames view={view} nameA={nameA} nameB={nameB} returnTo={returnTo} />

        {view.pairing.is_rematch ? (
          <p className="text-faint mt-6 max-w-prose text-xs leading-relaxed">
            These two have met before this season. The engine only repeats a
            matchup when no other pairing of the round was possible.
          </p>
        ) : null}
      </main>
    </>
  );
}
