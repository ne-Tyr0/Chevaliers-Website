import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { arbiterPasscode, officerPasscode } from "@/lib/env";

const COOKIE_NAME = "chevaliers_role";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Who is holding the passcode.
 *
 * `officer` can do everything. `arbiter` can only enter results and forfeits in
 * the round that is currently open — no roster, no seasons, no past rounds.
 */
export type ClubRole = "officer" | "arbiter";

function passcodeFor(role: ClubRole): string | null {
  if (role === "officer") return officerPasscode();
  return arbiterPasscode();
}

/**
 * The value stored in the cookie for a role.
 *
 * Derived from the passcode rather than being the passcode, so the secret never
 * reaches the browser. Changing a passcode invalidates every cookie issued
 * under it, which is what you want when officers hand over at the end of a year.
 */
function expectedToken(role: ClubRole): string | null {
  const passcode = passcodeFor(role);
  if (!passcode) return null;
  return createHmac("sha256", passcode).update(`chevaliers-${role}-v1`).digest("hex");
}

/** Constant-time compare, so a wrong guess leaks nothing through timing. */
function matches(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** The role this request holds, or null if it holds none. */
export async function currentRole(): Promise<ClubRole | null> {
  const raw = (await cookies()).get(COOKIE_NAME)?.value;
  if (!raw) return null;

  const separator = raw.indexOf(".");
  if (separator < 0) return null;
  const role = raw.slice(0, separator) as ClubRole;
  const token = raw.slice(separator + 1);
  if (role !== "officer" && role !== "arbiter") return null;

  try {
    const expected = expectedToken(role);
    return expected !== null && matches(token, expected) ? role : null;
  } catch {
    // The passcode for that role is not configured, so nobody holds it.
    return null;
  }
}

export async function isOfficer(): Promise<boolean> {
  return (await currentRole()) === "officer";
}

/** Officers and arbiters may both report results. */
export async function canEnterResults(): Promise<boolean> {
  return (await currentRole()) !== null;
}

/**
 * Check a submitted passcode against both roles and remember whichever matched.
 * Officer is tried first, so if the two were ever set to the same string the
 * more capable role wins.
 */
export async function signIn(submitted: string): Promise<ClubRole | null> {
  for (const role of ["officer", "arbiter"] as const) {
    let passcode: string | null = null;
    try {
      passcode = passcodeFor(role);
    } catch {
      continue;
    }
    if (!passcode || !matches(submitted, passcode)) continue;

    const token = expectedToken(role);
    if (!token) continue;

    (await cookies()).set(COOKIE_NAME, `${role}.${token}`, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    });
    return role;
  }
  return null;
}

export async function signOut(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
  (await cookies()).delete(REVIEW_COOKIE);
}

// ---------------------------------------------------------------------------
// Reviewing closed rounds
// ---------------------------------------------------------------------------
//
// Correcting a finished round rewrites history: scores and both tiebreaks are
// derived from games, so fixing a round 1 result reshuffles the whole season.
// That deserves more than the month-long officer cookie behind it, so it takes
// the passcode again and the permission lapses on its own shortly after.

const REVIEW_COOKIE = "chevaliers_review";
const REVIEW_WINDOW_MS = 15 * 60 * 1000;

/** Signs an expiry so the browser cannot simply extend its own permission. */
function reviewToken(expiresAt: number): string {
  return createHmac("sha256", officerPasscode())
    .update(`review-${expiresAt}`)
    .digest("hex");
}

/**
 * Re-check the officer passcode and open the review window.
 * Returns the moment it lapses, or null if the passcode was wrong.
 */
export async function grantReview(submitted: string): Promise<number | null> {
  if (!(await isOfficer())) return null;
  if (!matches(submitted, officerPasscode())) return null;

  const expiresAt = Date.now() + REVIEW_WINDOW_MS;
  (await cookies()).set(REVIEW_COOKIE, `${expiresAt}.${reviewToken(expiresAt)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(REVIEW_WINDOW_MS / 1000),
  });
  return expiresAt;
}

/** When the review window lapses, or null if it is not open. */
export async function reviewExpiresAt(): Promise<number | null> {
  if (!(await isOfficer())) return null;

  const raw = (await cookies()).get(REVIEW_COOKIE)?.value;
  if (!raw) return null;

  const separator = raw.indexOf(".");
  if (separator < 0) return null;
  const expiresAt = Number(raw.slice(0, separator));
  const token = raw.slice(separator + 1);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;

  try {
    return matches(token, reviewToken(expiresAt)) ? expiresAt : null;
  } catch {
    return null;
  }
}

export async function canReviewPastRounds(): Promise<boolean> {
  return (await reviewExpiresAt()) !== null;
}

export async function endReview(): Promise<void> {
  (await cookies()).delete(REVIEW_COOKIE);
}

/** Guard for edits to a round that has already been closed. */
export async function assertCanReviewPastRounds(): Promise<void> {
  if (!(await canReviewPastRounds())) {
    throw new Error("Re-enter the officer passcode to change a closed round.");
  }
}

/**
 * Guard for server actions that only officers may run. These execute under the
 * service role, which bypasses row level security, so every one must call this.
 */
export async function assertOfficer(): Promise<void> {
  if (!(await isOfficer())) throw new Error("Officer passcode required.");
}

/** Guard for actions an arbiter may also run. */
export async function assertCanEnterResults(): Promise<ClubRole> {
  const role = await currentRole();
  if (!role) throw new Error("Officer or arbiter passcode required.");
  return role;
}
