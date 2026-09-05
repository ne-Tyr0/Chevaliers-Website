import { NextResponse } from "next/server";
import { isAllowedEmail } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Only allow relative paths back into this site, so a crafted `next` parameter
 * cannot turn the sign-in link into an open redirect.
 */
function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNextPath(searchParams.get("next"));

  const failure = (reason: string) =>
    NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(reason)}`);

  if (!code) return failure("missing_code");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return failure(error.message);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Google's `hd` parameter only filters the account chooser, so the address is
  // verified here now that we actually hold the session.
  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return failure("domain");
  }

  return NextResponse.redirect(`${origin}${next}`);
}
