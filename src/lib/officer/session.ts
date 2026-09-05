import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { officerPasscode } from "@/lib/env";

const COOKIE_NAME = "chevaliers_officer";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * The value stored in the officer's cookie.
 *
 * Derived from the passcode rather than being the passcode, so the secret never
 * travels to the browser and never sits in a cookie jar. Changing
 * OFFICER_PASSCODE invalidates every existing cookie, which is what you want
 * when officers hand over at the end of the year.
 */
function expectedToken(): string {
  return createHmac("sha256", officerPasscode()).update("officer-v1").digest("hex");
}

/** Constant-time compare, so a wrong guess leaks nothing through timing. */
function matches(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

/** Whether the current request carries a valid officer cookie. */
export async function isOfficer(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    return matches(token, expectedToken());
  } catch {
    // OFFICER_PASSCODE is not configured; nobody is an officer.
    return false;
  }
}

/**
 * Check a submitted passcode and, if it is right, remember it.
 * Returns false rather than throwing so the form can show a message.
 */
export async function signInOfficer(submitted: string): Promise<boolean> {
  if (!matches(submitted, officerPasscode())) return false;

  (await cookies()).set(COOKIE_NAME, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return true;
}

export async function signOutOfficer(): Promise<void> {
  (await cookies()).delete(COOKIE_NAME);
}

/**
 * Guard for server actions. Officer actions run under the service role, which
 * bypasses row level security, so every one of them must call this first.
 */
export async function assertOfficer(): Promise<void> {
  if (!(await isOfficer())) {
    throw new Error("Officer passcode required.");
  }
}
