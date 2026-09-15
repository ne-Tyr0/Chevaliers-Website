import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, SearchIcon } from "@/components/icons";
import { SiteHeader } from "@/components/site-header";
import { EmptyState, PageHeader } from "@/components/ui";
import { getRoster } from "@/lib/club/queries";
import { getSeasonSnapshot } from "@/lib/club/snapshot";
import { getTerms } from "@/lib/club/wording";
import { currentRole } from "@/lib/officer/session";
import { formatPoints, ordinal, shortName } from "@/lib/terms";

export const metadata: Metadata = { title: "Players" };

/** Lower case with accents stripped, so "peña" is found by typing "pena". */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * Every player, with a search box.
 *
 * The search is a plain form that reloads with `?q=`, so it works on any phone
 * without JavaScript and a search can be shared as a link. It is a visible
 * box rather than a search icon: NN/g found people look for the box, not the
 * link.
 */
export default async function PlayersPage({ searchParams }: PageProps<"/players">) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q.trim() : "";

  const [role, snapshot, roster, terms] = await Promise.all([
    currentRole(),
    getSeasonSnapshot(),
    getRoster(),
    getTerms(),
  ]);

  // Everyone active, plus anyone retired who still has games this season.
  const players = roster.filter(
    (p) => p.is_active || snapshot?.rowById.has(p.id),
  );

  const needle = fold(query);
  const matches = needle
    ? players.filter((p) =>
        [p.full_name, shortName(p.full_name), p.grade ?? ""].some((field) =>
          fold(field).includes(needle),
        ),
      )
    : players;
  const ordered = [...matches].sort((a, b) => a.full_name.localeCompare(b.full_name));

  return (
    <>
      <SiteHeader role={role} currentPath="/players" />

      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <PageHeader
          title="Players"
          description="Find anyone in the club to see their place in the table and every game they have played this season."
        />

        <form role="search" action="/players" className="mt-6 flex gap-2">
          <label htmlFor="player-search" className="sr-only">
            Search players by name, grade or section
          </label>
          <div className="relative min-w-0 flex-1">
            <SearchIcon className="text-muted pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2" />
            <input
              id="player-search"
              name="q"
              type="search"
              defaultValue={query}
              placeholder="Search by name, grade or section"
              autoComplete="off"
              className="field pl-11"
            />
          </div>
          <button type="submit" className="btn-primary shrink-0">
            Search
          </button>
        </form>

        {query ? (
          <p className="text-muted mt-4 flex flex-wrap items-center gap-x-3 text-sm" aria-live="polite">
            {ordered.length === 0
              ? `Nobody matches “${query}”.`
              : `${ordered.length} ${ordered.length === 1 ? "player matches" : "players match"} “${query}”.`}
            <Link href="/players" className="link inline-flex min-h-11 items-center">
              Show everyone
            </Link>
          </p>
        ) : null}

        {players.length === 0 ? (
          <EmptyState>The roster is empty. Officers add players by name.</EmptyState>
        ) : ordered.length > 0 ? (
          <ul className="card mt-6 p-2">
            {ordered.map((player) => {
              const row = snapshot?.rowById.get(player.id);
              return (
                <li
                  key={player.id}
                  className="border-b last:border-b-0"
                  style={{ borderColor: "var(--rule)" }}
                >
                  <Link href={`/players/${player.id}`} className="row-link mx-0 px-3">
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{player.full_name}</span>
                      <span className="text-muted block text-sm">
                        {[player.grade, player.is_active ? null : "no longer playing"]
                          .filter(Boolean)
                          .join(" · ") || " "}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-sm">
                      {row ? (
                        <>
                          <span className="block font-semibold">{ordinal(row.rank)}</span>
                          <span className="text-muted block tabular-nums">
                            {formatPoints(row.score)} {terms.points.toLowerCase()}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">No games yet</span>
                      )}
                    </span>
                    <ChevronRight className="text-faint size-5 shrink-0" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </main>
    </>
  );
}
