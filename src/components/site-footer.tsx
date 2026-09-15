import Link from "next/link";
import { Pawn } from "./pawn";
import { Wordmark } from "./wordmark";

/*
 * Three details the code cannot know. Fill them in before deploying — the
 * email in particular is a placeholder and will bounce.
 */
const CLUB_EMAIL = "chevaliers@cvisc.pshs.edu.ph";
const BUILT_BY = "Will Tyrone Araneta";
const SOURCE_URL = "https://github.com/ne-Tyr0/Chevaliers-Website";

/** Footer links sit one step quieter than the header's, and warm on hover. */
const LINK = "text-muted transition-colors hover:text-ink";

/**
 * The site footer, rendered once in the root layout rather than per page.
 *
 * Deliberately not role-aware: unlike the header, nothing here changes for an
 * officer or an arbiter, so it stays a plain server component with no session
 * lookup. The "Officers" link is the same door everyone sees — it asks for a
 * passcode on the other side.
 */
export function SiteFooter() {
  return (
    <footer
      className="mt-auto shrink-0 border-t"
      style={{ borderColor: "var(--rule)" }}
    >
      <div className="mx-auto max-w-5xl px-6 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <div className="flex items-center gap-2.5">
              <Pawn className="h-5 w-auto shrink-0" />
              <Wordmark className="text-lg" />
            </div>
            <p className="text-muted mt-3 text-sm leading-relaxed">
              Standings and Swiss pairings for the school chess club. One season
              is one continuous event, and one club meeting is one round.
            </p>
          </div>

          <div className="flex gap-12 sm:gap-16">
            <nav aria-label="Footer">
              <h2 className="label">The season</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/standings" className={LINK}>
                    Standings
                  </Link>
                </li>
                <li>
                  <Link href="/results" className={LINK}>
                    Pairings &amp; results
                  </Link>
                </li>
                <li>
                  <Link href="/officer" className={LINK}>
                    Officer tools
                  </Link>
                </li>
              </ul>
            </nav>

            <div>
              <h2 className="label">The club</h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link href="/suggest" className={LINK}>
                    Suggest a feature
                  </Link>
                </li>
                <li>
                  <a
                    href={`mailto:${CLUB_EMAIL}`}
                    className={LINK}
                  >
                    {CLUB_EMAIL}
                  </a>
                </li>
                <li>
                  <a
                    href={SOURCE_URL}
                    target="_blank"
                    rel="noreferrer"
                    className={LINK}
                  >
                    Source on GitHub
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div
          className="mt-12 border-t pt-6"
          style={{ borderColor: "var(--rule)" }}
        >
          <h2 className="label">AI assistance disclosure</h2>
          <p className="text-faint mt-2 max-w-prose text-xs leading-relaxed">
            This website was built with the help of AI coding assistants, and
            then reviewed, tested and published by club members, who are
            responsible for everything on it. The site itself contains no AI:
            pairings come from a published Swiss algorithm, and every colour,
            score and result is entered by an officer or arbiter from a game
            played at the board. Nothing here is generated, predicted or
            guessed. If something looks wrong, it is a human mistake worth
            reporting &mdash; please tell an officer.
          </p>
        </div>

        <p className="text-faint mt-8 flex flex-wrap gap-x-3 gap-y-1 text-xs">
          <span>&copy; {new Date().getFullYear()} Chevaliers Chess Club</span>
          <span aria-hidden="true">&middot;</span>
          <span>Built by {BUILT_BY}</span>
        </p>
      </div>
    </footer>
  );
}

