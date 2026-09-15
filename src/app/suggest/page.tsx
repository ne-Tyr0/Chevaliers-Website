import type { Metadata } from "next";
import Link from "next/link";
import { Pawn } from "@/components/pawn";
import { ErrorNote, PageHeader } from "@/components/ui";
import { submitSuggestion } from "@/lib/club/actions";
import {
  SUGGESTION_MAX_LENGTH,
  SUGGESTION_NAME_MAX_LENGTH,
} from "@/lib/club/suggestions";

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

  return (
    <>
      <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-14">
        <PageHeader
          crumbs={[{ href: "/about", label: "About the club" }]}
          title="Suggest a feature"
        />

        {sent ? <Sent /> : <SuggestionForm error={error} />}
      </main>
    </>
  );
}

function Sent() {
  return (
    <section className="card mt-8 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <Pawn className="mt-0.5 h-6 w-auto shrink-0" />
        <p className="max-w-prose leading-relaxed">
          Thank you. Your suggestion went straight to the club officers, who
          read every one. It is not posted anywhere public.
        </p>
      </div>
      <div className="mt-8 flex flex-wrap gap-3 text-sm">
        <Link href="/suggest" className="btn">
          Suggest something else
        </Link>
        <Link href="/" className="link inline-flex min-h-11 items-center px-2">
          Back to the home page
        </Link>
      </div>
    </section>
  );
}

function SuggestionForm({ error }: { error: string | null }) {
  return (
    <>
      <p className="text-muted mt-3 max-w-prose leading-relaxed">
        Something you wish this site did, a page that would help, or anything
        that gets in the way. Your suggestion goes only to the club officers.
      </p>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <form action={submitSuggestion} className="card mt-8 p-5 sm:p-6">
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
          className="field mt-1.5 resize-y py-3 leading-relaxed"
        />

        <label className="label mt-6 block" htmlFor="suggestion-name">
          Your name <span className="font-normal">(optional)</span>
        </label>
        <input
          id="suggestion-name"
          name="name"
          autoComplete="name"
          maxLength={SUGGESTION_NAME_MAX_LENGTH}
          className="field mt-1.5"
        />
        <p className="text-muted mt-2 text-sm leading-relaxed">
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

        <button type="submit" className="btn-primary mt-6">
          Send suggestion
        </button>
      </form>
    </>
  );
}
