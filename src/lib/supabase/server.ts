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
 * exactly why it must only be constructed inside a server action that has
 * already verified the officer passcode — never in a component that renders.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
