import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronDown } from "@/components/icons";
import { PlayersTabs } from "@/components/players-tabs";
import { CardsSkeleton } from "@/components/skeletons";
import { EmptyState, ErrorNote, PageHeader, SectionHeading } from "@/components/ui";
import {
  formatSchoolYear,
  getOfficerYears,
  schoolYearOf,
} from "@/lib/club/officers";
import { getRoster } from "@/lib/club/queries";
import { currentRole } from "@/lib/officer/session";
import type { ClubOfficerRow, PlayerRow } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Officers & adviser" };

/**
 * Who runs the club: this school year's officers and adviser first, then
 * earlier years folded away underneath.
 *
 * "This year" is the newest year anyone has been entered for, not the calendar
 * year, so the page never goes blank in June just because the new officers
 * have not been added yet.
 */
export default function OfficersPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
      <PageHeader
        title="Players"
        description="The people who run the club, and who to talk to about joining or anything else."
      />
      <PlayersTabs current="officers" />
      <Suspense fallback={<CardsSkeleton />}>
        <OfficersBody />
      </Suspense>
    </main>
  );
}

async function OfficersBody() {
  const [{ years, error }, roster, role] = await Promise.all([
    getOfficerYears(),
    getRoster(),
    currentRole(),
  ]);
  const playerById = new Map(roster.map((p) => [p.id, p]));
  const [latest, ...earlier] = years;
  const calendarYear = schoolYearOf(new Date());

  return (
    <>
      {error ? (
        <ErrorNote>
          The officers list could not be loaded. If this is a new install, run
          supabase/migrations/0010_club_officers.sql.
        </ErrorNote>
      ) : !latest ? (
        <EmptyState
          action={
            role === "officer" ? (
              <Link href="/officer?tab=officers" className="btn">
                Add officers
              </Link>
            ) : undefined
          }
        >
          The officers and adviser for this school year have not been added
          yet.
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby="current-heading" className="mt-8">
            <SectionHeading
              id="current-heading"
              aside={
                latest.schoolYear !== calendarYear ? "Most recent year entered" : undefined
              }
            >
              {formatSchoolYear(latest.schoolYear)}
            </SectionHeading>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {latest.officers.map((officer, index) => (
                <OfficerCard
                  key={officer.id}
                  officer={officer}
                  player={officer.player_id ? playerById.get(officer.player_id) : undefined}
                  index={index}
                />
              ))}
            </ul>
          </section>

          {earlier.length > 0 ? (
            <section aria-labelledby="past-heading" className="mt-14">
              <SectionHeading id="past-heading">Past officers</SectionHeading>
              <div className="mt-4 space-y-3">
                {earlier.map((year) => (
                  <details key={year.schoolYear} className="card group">
                    <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3">
                      <span className="font-medium">{formatSchoolYear(year.schoolYear)}</span>
                      <span className="text-muted flex items-center gap-2 text-sm">
                        {year.officers.length}{" "}
                        {year.officers.length === 1 ? "person" : "people"}
                        <ChevronDown className="size-5 transition-transform group-open:rotate-180" />
                      </span>
                    </summary>
                    <ul
                      className="grid gap-x-8 gap-y-3 border-t px-5 py-4 sm:grid-cols-2"
                      style={{ borderColor: "var(--rule)" }}
                    >
                      {year.officers.map((officer) => (
                        <li key={officer.id}>
                          <p className="text-muted text-sm">{officer.position}</p>
                          <PersonName
                            officer={officer}
                            player={
                              officer.player_id ? playerById.get(officer.player_id) : undefined
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </details>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}

function OfficerCard({
  officer,
  player,
  index,
}: {
  officer: ClubOfficerRow;
  player: PlayerRow | undefined;
  index: number;
}) {
  return (
    <li
      className="card reveal flex flex-col p-5"
      style={{ "--i": index } as React.CSSProperties}
    >
      <p className="text-muted text-sm font-medium">{officer.position}</p>
      <p className="font-display mt-1 text-xl font-semibold">
        <PersonName officer={officer} player={player} />
      </p>
      {player?.grade ? <p className="text-muted mt-0.5 text-sm">{player.grade}</p> : null}
      {officer.message ? (
        <p
          className="mt-3 border-t pt-3 leading-relaxed break-words"
          style={{ borderColor: "var(--rule)" }}
        >
          {officer.message}
        </p>
      ) : null}
    </li>
  );
}

/** A roster player links to their page; anyone else is just their name. */
function PersonName({
  officer,
  player,
}: {
  officer: ClubOfficerRow;
  player: PlayerRow | undefined;
}) {
  if (player) {
    return (
      <Link href={`/players/${player.id}`} className="link">
        {player.full_name}
      </Link>
    );
  }
  return <span>{officer.name ?? "Unnamed"}</span>;
}
