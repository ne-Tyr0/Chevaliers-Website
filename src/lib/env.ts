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
 * The school domain sign-ins are restricted to, for example `example.edu`.
 * Server-side only — it is deliberately not a NEXT_PUBLIC_ variable.
 */
export function allowedEmailDomain(): string {
  return required("ALLOWED_EMAIL_DOMAIN", process.env.ALLOWED_EMAIL_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
}

/**
 * Whether an address belongs to the club's school domain.
 *
 * Google is also told to restrict the account chooser via its `hd` parameter,
 * but that is a hint to the sign-in UI rather than a guarantee, so the address
 * is checked again here once we actually hold the session.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const domain = allowedEmailDomain();
  return email.trim().toLowerCase().endsWith(`@${domain}`);
}
