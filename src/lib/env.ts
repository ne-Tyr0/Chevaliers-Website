/**
 * Environment configuration.
 *
 * Read through helpers rather than touching `process.env` directly, so a
 * missing value fails loudly at the point of use instead of silently becoming
 * `undefined` somewhere further downstream.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export function supabaseUrl(): string {
  return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export function supabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

/**
 * Bypasses row level security, so it must never reach the browser. Only ever
 * used inside server actions that have already checked the officer passcode.
 */
export function supabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/** The shared secret that unlocks the officer screens. */
export function officerPasscode(): string {
  return required("OFFICER_PASSCODE", process.env.OFFICER_PASSCODE);
}

/**
 * The secret that lets an arbiter report results, and nothing else.
 *
 * Optional: a club that does not use arbiters simply leaves it unset, and the
 * arbiter screen reports that it is not configured rather than failing.
 */
export function arbiterPasscode(): string | null {
  const value = process.env.ARBITER_PASSCODE?.trim();
  return value ? value : null;
}
