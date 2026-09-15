import type { Metadata } from "next";
import Link from "next/link";
import { MoreLink, PageHeader, SectionHeading } from "@/components/ui";
import { CLUB_INFO, isPlaceholder } from "@/lib/club/info";
import { getTerms } from "@/lib/club/wording";
import { termsFor } from "@/lib/terms";

export const metadata: Metadata = { title: "About the club" };

const SECTIONS = [
  { id: "meetings", label: "When we meet" },
  { id: "join", label: "How to join" },
  { id: "scoring", label: "How the standings work" },
  { id: "words", label: "Chess terms explained" },
] as const;

/**
 * Everything that explains rather than reports: the club, joining, and how the
 * scoring works.
 *
 * The standings and home pages used to carry paragraphs about Buchholz, byes
 * and rounds from before the site. Moving the detail here keeps those pages
 * about the results while the explanation stays one link away.
 */
export default async function AboutPage() {
  const terms = await getTerms();
  const plain = termsFor("plain");
  const chess = termsFor("chess");

  const glossary = [
    {
      plain: "Match",
      chess: "Matchup",
      meaning: "Three games in one round against the same opponent.",
    },
    {
      plain: "Table",
      chess: "Board",
      meaning: "Where a match is played. Tables are numbered from 1.",
    },
    {
      plain: "Points",
      chess: "Score",
      meaning: "1 for each game won, ½ for each draw, 0 for a loss.",
    },
    {
      plain: "Free round",
      chess: "Bye",
      meaning:
        "With an odd number of players, one sits the round out and gets the points of a won match, so nobody loses out because the numbers did not work.",
    },
    {
      plain: "Won, opponent absent",
      chess: "Forfeit win (+ −)",
      meaning:
        "The opponent did not turn up. It counts as a win for points, but not as a game played.",
    },
    {
      plain: "Both absent",
      chess: "Double forfeit (− −)",
      meaning: "Neither player turned up. Nobody gets a point.",
    },
    {
      plain: plain.buchholz,
      chess: chess.buchholz,
      meaning: plain.buchholzHint,
    },
    {
      plain: plain.sonnebornBerger,
      chess: chess.sonnebornBerger,
      meaning: plain.sonnebornBergerHint,
    },
    {
      plain: "Played before",
      chess: "Rematch",
      meaning:
        "Two players who have already met this season. It only happens when no other pairing of the round was possible.",
    },
    {
      plain: "Paired with someone on similar points",
      chess: "Swiss system",
      meaning:
        "How opponents are chosen each round: players on similar points face each other, and nobody plays the same person twice if it can be avoided.",
    },
    {
      plain: "“Maria won”, “Draw”",
      chess: "1–0, ½–½, 0–1",
      meaning:
        "A game's result. In chess notation the first number is the first-named player's score.",
    },
  ];

  return (
    <>
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 sm:py-14">
        <PageHeader title="About the club" description={CLUB_INFO.about} />

        <nav aria-label="On this page" className="card mt-8 p-5">
          <p className="label">On this page</p>
          <ul className="mt-2 grid gap-x-6 sm:grid-cols-2">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="link inline-flex min-h-11 items-center"
                >
                  {section.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <section id="meetings" className="mt-14 scroll-mt-6">
          <SectionHeading>When we meet</SectionHeading>
          <dl className="card mt-4 divide-y" style={{ borderColor: "var(--rule-strong)" }}>
            {CLUB_INFO.meetings.map((item) => (
              <div
                key={item.label}
                className="grid gap-1 px-5 py-4 sm:grid-cols-[8rem_1fr]"
                style={{ borderColor: "var(--rule)" }}
              >
                <dt className="font-medium">{item.label}</dt>
                <dd>
                  <Value text={item.value} />
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section id="join" className="mt-14 scroll-mt-6">
          <SectionHeading>How to join</SectionHeading>
          <ol className="mt-4 space-y-3">
            {CLUB_INFO.join.map((step, index) => (
              <li key={step} className="card flex gap-4 p-5">
                <span className="bg-ink text-cream flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                  {index + 1}
                </span>
                <p className="pt-1 leading-relaxed">
                  <Value text={step} />
                </p>
              </li>
            ))}
          </ol>
          <p className="text-muted mt-4 leading-relaxed">
            Questions? <Value text={CLUB_INFO.contact} />
          </p>
          <MoreLink href="/players/officers">Meet the officers and adviser</MoreLink>
        </section>

        <section id="scoring" className="mt-14 scroll-mt-6">
          <SectionHeading>How the standings work</SectionHeading>
          <div className="mt-4 space-y-4 leading-relaxed">
            <p>
              <strong className="font-semibold">A season is one long tournament.</strong>{" "}
              Every club meeting is a round. You do not have to come every week to
              stay in the table.
            </p>
            <p>
              <strong className="font-semibold">Each round, everyone is paired.</strong>{" "}
              You play three games against one opponent, chosen from players on
              similar points who you have not played yet.
              {terms.chess ? " (This is a Swiss system.)" : ""}
            </p>
            <p>
              <strong className="font-semibold">Every game counts.</strong> A win
              is 1 point, a draw ½, a loss 0. So winning a match 2–1 is worth 2
              points, and the loser still gets 1.
            </p>
            <p>
              <strong className="font-semibold">Ties are broken fairly.</strong>{" "}
              When players have the same points, the one who faced tougher
              opponents goes higher ({chess.buchholz}). If that is also level,
              the one whose wins came against tougher opponents goes higher
              ({chess.sonnebornBerger}).
            </p>
            <p>
              <strong className="font-semibold">Missing a round.</strong> A free
              round given to balance odd numbers is worth a whole match, so it
              never costs anyone. If you are absent, you score nothing for that
              round, which is why the standings show games played next to every
              score. Free rounds and games won because the opponent did not turn
              up count for points, but not for games played or tiebreaks.
            </p>
          </div>

          <div id="earlier-rounds" className="card mt-6 scroll-mt-6 p-5">
            <h3 className="text-lg">Rounds from before this site</h3>
            <p className="text-muted mt-2 leading-relaxed">
              The club played earlier rounds of the Inaugural Games before the site
              existed. Those survive only as totals on the printed sheets, and the
              tiebreaks need individual game results, so they are kept on the
              club&rsquo;s own sheets rather than entered here. The standings on
              this site count the rounds recorded on it.
            </p>
          </div>
        </section>

        <section id="words" className="mt-14 scroll-mt-6">
          <SectionHeading>Chess terms explained</SectionHeading>
          <p className="text-muted mt-2 leading-relaxed">
            The site uses everyday words unless you switch to chess terms on the
            standings, results or player pages. Both mean the same thing.
          </p>
          <div className="card mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-left text-[0.9375rem]">
              <thead>
                <tr className="border-b" style={{ borderColor: "var(--rule-strong)" }}>
                  <th scope="col" className="label px-5 py-3 font-medium">
                    Everyday words
                  </th>
                  <th scope="col" className="label px-5 py-3 font-medium">
                    Chess term
                  </th>
                  <th scope="col" className="label hidden px-5 py-3 font-medium sm:table-cell">
                    What it means
                  </th>
                </tr>
              </thead>
              <tbody>
                {glossary.map((entry) => (
                  <tr
                    key={entry.chess}
                    className="border-b align-top last:border-b-0"
                    style={{ borderColor: "var(--rule)" }}
                  >
                    <td className="px-5 py-3 font-medium">
                      {entry.plain}
                      <span className="text-muted mt-1 block text-sm font-normal sm:hidden">
                        {entry.meaning}
                      </span>
                    </td>
                    <td className="px-5 py-3">{entry.chess}</td>
                    <td className="text-muted hidden px-5 py-3 sm:table-cell">
                      {entry.meaning}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-14">
          <SectionHeading>Help improve this site</SectionHeading>
          <p className="text-muted mt-2 leading-relaxed">
            Something confusing, missing or wrong? Tell the officers.
          </p>
          <MoreLink href="/suggest">Suggest a change</MoreLink>
          <p className="text-muted mt-6 text-sm">
            Running the club?{" "}
            <Link href="/officer" className="link">
              Officer and arbiter sign-in
            </Link>
          </p>
        </section>
      </main>
    </>
  );
}

/** A club detail, outlined while it is still a placeholder waiting to be filled in. */
function Value({ text }: { text: string }) {
  if (!isPlaceholder(text)) return <>{text}</>;
  return (
    <span
      className="text-muted rounded border border-dashed px-1.5 py-0.5"
      style={{ borderColor: "var(--rule-strong)" }}
      title="Placeholder — officers can fill this in"
    >
      {text.slice(1, -1)}
    </span>
  );
}
