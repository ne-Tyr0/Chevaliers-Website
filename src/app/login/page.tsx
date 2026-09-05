import type { Metadata } from "next";
import { Pawn } from "@/components/pawn";
import { Wordmark } from "@/components/wordmark";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Sign in" };

const MESSAGES: Record<string, string> = {
  domain:
    "That account is not on the club's school domain. Sign in with your school Google account.",
  missing_code: "The sign-in link was incomplete. Please try again.",
  oauth_failed: "Google sign-in could not be started. Please try again.",
  officers_only: "That page is for club officers.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const rawError = typeof params.error === "string" ? params.error : null;
  const next = typeof params.next === "string" ? params.next : "/";
  const message = rawError ? (MESSAGES[rawError] ?? rawError) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <Pawn className="mb-8 h-10 w-auto" />

      <h1 className="text-4xl">
        <Wordmark />
      </h1>
      <p className="text-muted mt-3 text-balance">
        Standings and pairings for the school chess club.
      </p>

      {message ? (
        <p
          role="alert"
          className="mt-8 border-l-2 py-1 pl-4 text-sm"
          style={{ borderColor: "var(--color-ink)" }}
        >
          {message}
        </p>
      ) : null}

      <form action={signInWithGoogle} className="mt-10">
        <input type="hidden" name="next" value={next} />
        <button
          type="submit"
          className="w-full cursor-pointer border px-5 py-3 text-sm transition-colors hover:bg-ink hover:text-cream"
          style={{ borderColor: "var(--color-ink)" }}
        >
          Continue with your school Google account
        </button>
      </form>

      <p className="text-faint mt-6 text-xs leading-relaxed">
        Only members of the club&rsquo;s school domain can sign in. Your account is
        created automatically the first time.
      </p>
    </main>
  );
}
