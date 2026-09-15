import { cookies } from "next/headers";
import { cache } from "react";
import { createPublicClient } from "@/lib/supabase/server";
import {
  parseWording,
  termsFor,
  WORDING_COOKIE,
  type Terms,
  type Wording,
} from "@/lib/terms";

/**
 * The wording a first-time visitor starts with, as officers have set it.
 *
 * Falls back to everyday words if the settings table is missing or unreadable,
 * so a site whose 0009 migration has not run yet still renders.
 */
export const getDefaultWording = cache(async (): Promise<Wording> => {
  const { data } = await createPublicClient()
    .from("site_settings")
    .select("chess_terms_default")
    .maybeSingle();
  return data?.chess_terms_default ? "chess" : "plain";
});

/** The wording this visitor has chosen, or the site default if they have not. */
export const getTerms = cache(async (): Promise<Terms> => {
  const chosen = parseWording((await cookies()).get(WORDING_COOKIE)?.value);
  return termsFor(chosen ?? (await getDefaultWording()));
});
