import { cache } from "react";
import { assertOfficer } from "@/lib/officer/session";
import { createAdminClient } from "@/lib/supabase/server";
import type { SuggestionRow, SuggestionStatus } from "@/lib/supabase/database.types";

/*
 * Reads for the officers' Suggestions tab.
 *
 * Kept apart from queries.ts because everything there is public and uses the
 * anon key. Suggestions have no read policy at all, so these need the service
 * role — and so each one checks the officer passcode before building it.
 */

/** Longest suggestion accepted, matching the check constraint in 0008. */
export const SUGGESTION_MAX_LENGTH = 2000;
/** Longest name accepted, matching the check constraint in 0008. */
export const SUGGESTION_NAME_MAX_LENGTH = 80;

export const SUGGESTION_STATUSES: readonly SuggestionStatus[] = [
  "new",
  "planned",
  "done",
  "declined",
];

/**
 * Every suggestion, newest first.
 *
 * Returns the error rather than an empty list, so a missing migration reads as
 * a problem on the officer tab instead of as "no suggestions yet".
 */
export const getSuggestions = cache(
  async (): Promise<{ suggestions: SuggestionRow[]; error: string | null }> => {
    await assertOfficer();
    const { data, error } = await createAdminClient()
      .from("suggestions")
      .select("*")
      .order("created_at", { ascending: false });
    return { suggestions: data ?? [], error: error?.message ?? null };
  },
);

/** How many suggestions no officer has triaged yet, for the tab badge. */
export const countNewSuggestions = cache(async (): Promise<number> => {
  await assertOfficer();
  const { count } = await createAdminClient()
    .from("suggestions")
    .select("id", { count: "exact", head: true })
    .eq("status", "new");
  return count ?? 0;
});
