import { cache } from "react";
import type { ClubOfficerRow } from "@/lib/supabase/database.types";
import { createPublicClient } from "@/lib/supabase/server";

/*
 * Officers and advisers, by school year.
 */

/** Suggested titles, in the order they are usually listed. Any title can be typed. */
export const SUGGESTED_POSITIONS = [
  "Adviser",
  "President",
  "Vice President",
  "Secretary",
  "Treasurer",
  "Auditor",
  "Public Relations Officer",
  "Grade Representative",
] as const;

export const OFFICER_POSITION_MAX_LENGTH = 60;
export const OFFICER_NAME_MAX_LENGTH = 120;
export const OFFICER_MESSAGE_MAX_LENGTH = 160;

const SCHOOL_YEAR = /^(\d{4})-(\d{4})$/;

/**
 * The school year a date falls in, as "2026-2027".
 *
 * Philippine school years start mid-year, so June onwards belongs to the year
 * that is starting. A date in, say, March is still the year that began the
 * previous June.
 */
export function schoolYearOf(date: Date): string {
  const year = date.getFullYear();
  const start = date.getMonth() >= 5 ? year : year - 1;
  return `${start}-${start + 1}`;
}

/** Valid only if it reads "YYYY-YYYY" with consecutive years. */
export function parseSchoolYear(value: string): string | null {
  const match = SCHOOL_YEAR.exec(value);
  if (!match) return null;
  return Number(match[2]) === Number(match[1]) + 1 ? value : null;
}

/** "2026-2027" as "2026–2027", with a proper en dash for display. */
export function formatSchoolYear(value: string): string {
  return value.replace("-", "–");
}

/** A few years either side of now, for choosing which year an entry belongs to. */
export function schoolYearChoices(now: Date, existing: readonly string[]): string[] {
  const current = Number(schoolYearOf(now).slice(0, 4));
  const years = new Set(existing);
  for (let start = current - 3; start <= current + 1; start++) {
    years.add(`${start}-${start + 1}`);
  }
  return [...years].sort().reverse();
}

export interface OfficerYear {
  schoolYear: string;
  officers: ClubOfficerRow[];
}

/**
 * Every entry, grouped by school year, newest year first and each year in the
 * order officers arranged it.
 *
 * Returns the error rather than an empty list, so a missing migration reads as
 * a problem on the officer tab instead of as "nobody listed yet".
 */
export const getOfficerYears = cache(
  async (): Promise<{ years: OfficerYear[]; error: string | null }> => {
    const { data, error } = await createPublicClient()
      .from("club_officers")
      .select("*")
      .order("school_year", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });

    const years: OfficerYear[] = [];
    for (const row of data ?? []) {
      const last = years.at(-1);
      if (last?.schoolYear === row.school_year) last.officers.push(row);
      else years.push({ schoolYear: row.school_year, officers: [row] });
    }
    return { years, error: error?.message ?? null };
  },
);
