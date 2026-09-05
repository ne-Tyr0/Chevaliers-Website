"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { allowedEmailDomain } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Start the Google sign-in flow.
 *
 * Deliberately a server action: it keeps ALLOWED_EMAIL_DOMAIN off the client
 * while still passing it to Google as the `hd` hint, so members see only their
 * school account in the chooser.
 */
export async function signInWithGoogle(formData: FormData) {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "http";
  const origin = `${protocol}://${host}`;

  const next = formData.get("next");
  const callback = new URL("/auth/callback", origin);
  if (typeof next === "string" && next.startsWith("/") && !next.startsWith("//")) {
    callback.searchParams.set("next", next);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callback.toString(),
      queryParams: {
        hd: allowedEmailDomain(),
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    redirect(`/login?error=${encodeURIComponent(error?.message ?? "oauth_failed")}`);
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
