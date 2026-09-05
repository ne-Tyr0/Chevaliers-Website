import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client for server components, route handlers and server actions.
 *
 * Create a new one per request — never share it across requests, since it
 * carries the caller's session.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server components cannot set cookies. That is fine: the proxy
          // refreshes the session on every request, so the write here is only
          // ever a shortcut.
        }
      },
    },
  });
}
