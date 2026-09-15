import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseServiceRoleKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Read-only client for public pages.
 *
 * Uses the anon key, so it is bound by row level security: the policies allow
 * selects and nothing else. There are no sessions or cookies to carry, because
 * the site has no accounts.
 */
export function createPublicClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Privileged client for officer actions. Bypasses row level security, which is
 * exactly why it must only be constructed after the officer passcode has been
 * verified — inside a server action, or in one of the officer-only reads in
 * `lib/club/suggestions.ts`, which check it first. Never directly in a
 * component that renders.
 *
 * The one exception is `submitSuggestion`, the public form's action, which
 * inserts a single validated row and reads back only a count of recent ones.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
