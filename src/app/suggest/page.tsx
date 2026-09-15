import type { Metadata } from "next";
import Link from "next/link";
import { Pawn } from "@/components/pawn";
import { SiteHeader } from "@/components/site-header";
import { submitSuggestion } from "@/lib/club/actions";
import {
  SUGGESTION_MAX_LENGTH,
  SUGGESTION_NAME_MAX_LENGTH,
} from "@/lib/club/suggestions";
import { currentRole } from "@/lib/officer/session";

export const metadata: Metadata = { title: "Suggest a feature" };

/**
 * Anyone can suggest something the site should do. Suggestions go to the
 * officers' Suggestions tab and are never shown publicly.
 */
export default async function SuggestPage({
  searchParams,
}: PageProps<"/suggest">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const sent = params.sent === "1";
  const role = await currentRole();

  return (
    <>
      <SiteHeader role={role} currentPath="/suggest" />

      <main className="mx-auto w-full max-w-xl px-6 py-10 sm:py-16">
        <p className="label">Suggestions</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">Suggest a feature</h1>

        {sent ? <Sent /> : <SuggestionForm error={error} />}
      </main>
    </>
  );
}

function Sent() {
  return (
    <section className="mt-8">
      <div className="flex items-start gap-3">
        <Pawn className="text-faint mt-0.5 h-4 w-auto shrink-0" />
        <p className="text-muted max-w-prose text-sm leading-relaxed">
          Thank you. Your suggestion went straight to the club officers, who
          read every one. It is not posted anywhere public.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link
          href="/suggest"
          className="border px-5 py-2.5 transition-colors hover:bg-ink hover:text-cream"
          style={{ borderColor: "var(--color-ink)" }}
        >
          Suggest something else
        </Link>
        <Link
          href="/standings"
          className="text-muted px-2 py-2.5 transition-colors hover:text-ink"
        >
          Back to the standings
        </Link>
      </div>
    </section>
  );
}

function SuggestionForm({ error }: { error: string | null }) {
  return (
    <>
      <p className="text-muted mt-3 max-w-prose text-sm leading-relaxed">
        Something you wish this site did, a page that would help, or anything
        that gets in the way. Your suggestion goes only to the club officers.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-6 border-l-2 py-1 pl-4 text-sm"
          style={{ borderColor: "var(--color-ink)" }}
        >
          {error}
        </p>
      ) : null}

      <form action={submitSuggestion} className="mt-8">
        <label className="label block" htmlFor="suggestion-body">
          Your suggestion
        </label>
        <textarea
          id="suggestion-body"
          name="body"
          required
          rows={6}
          maxLength={SUGGESTION_MAX_LENGTH}
          placeholder="It would help if the standings page…"
          className="mt-2 block w-full resize-y border bg-transparent px-4 py-3 text-sm leading-relaxed"
          style={{ borderColor: "var(--rule-strong)" }}
        />

        <label className="label mt-6 block" htmlFor="suggestion-name">
          Your name <span className="normal-case tracking-normal">(optional)</span>
        </label>
        <input
          id="suggestion-name"
          name="name"
          autoComplete="name"
          maxLength={SUGGESTION_NAME_MAX_LENGTH}
          className="mt-2 w-full border bg-transparent px-4 py-2.5 text-sm"
          style={{ borderColor: "var(--rule-strong)" }}
        />
        <p className="text-faint mt-2 text-xs leading-relaxed">
          Leave it blank to stay anonymous. A name lets an officer follow up
          with you.
        </p>

        {/* Honeypot. Hidden from people and from screen readers, so only a bot
            that fills in every field will put anything here. */}
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="suggestion-website">Website</label>
          <input
            id="suggestion-website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>

        <button
          type="submit"
          className="mt-8 cursor-pointer border px-5 py-2.5 text-sm transition-colors hover:bg-ink hover:text-cream"
          style={{ borderColor: "var(--color-ink)" }}
        >
          Send suggestion
        </button>
      </form>
    </>
  );
}
