import type { PlayerOutcome } from "@/lib/swiss";
import type { DbPairingResult } from "@/lib/supabase/database.types";

/*
 * The site's two vocabularies.
 *
 * Feedback was that the site read as technical: Buchholz, byes, "1–0", "def.".
 * Those are the right words for people who run chess events and the wrong ones
 * for a parent checking who is top. So every term a newcomer might trip on has
 * an everyday version, which is the default, and the chess version, which any
 * visitor can switch to and officers can make the default.
 *
 * Only words change. Numbers, ordering and what is shown stay the same, apart
 * from the two tiebreak columns, which everyday mode leaves to the player page
 * rather than putting unexplained figures in the table.
 *
 * Plain wording follows GOV.UK's content guidance: short common words, and a
 * specialist term only where it earns its place, explained where it appears.
 */

export type Wording = "plain" | "chess";

export const WORDING_COOKIE = "chevaliers_wording";

/** Anything not exactly "chess" is everyday wording, the safer default. */
export function parseWording(value: string | null | undefined): Wording | null {
  if (value === "chess" || value === "plain") return value;
  return null;
}

export interface Terms {
  wording: Wording;
  chess: boolean;
  /** Column and stat heading for a player's total. */
  points: string;
  /** Column heading for games actually played at a board. */
  gamesPlayed: string;
  /** A set of three games against one opponent: "match" or "matchup". */
  match: string;
  matches: string;
  /** Where a match is played: "Table 3" or "Board 3". */
  board: string;
  /** Sitting a round out with the points awarded. */
  bye: string;
  byes: (count: number) => string;
  /** Two players who have met before this season. */
  rematch: string;
  buchholz: string;
  buchholzHint: string;
  sonnebornBerger: string;
  sonnebornBergerHint: string;
  /** Short heading for the won-drawn-lost column. */
  record: string;
  /** Games decided without being played. */
  forfeits: (count: number) => string;
  resultsTitle: string;
  /** One player's outcome in one game, lower case: "won", "free round". */
  outcome: (outcome: PlayerOutcome) => string;
  /** A game's result as the results page shows it. */
  gameResult: (result: DbPairingResult, nameA: string, nameB: string) => string;
}

const PLAIN_OUTCOME: Record<PlayerOutcome, string> = {
  win: "won",
  loss: "lost",
  draw: "drew",
  bye: "free round",
  forfeit_win: "won, opponent absent",
  forfeit_loss: "lost, absent",
  double_forfeit: "both absent",
};

const CHESS_OUTCOME: Record<PlayerOutcome, string> = {
  win: "won",
  loss: "lost",
  draw: "drew",
  bye: "bye",
  forfeit_win: "won by forfeit",
  forfeit_loss: "lost by forfeit",
  double_forfeit: "double forfeit",
};

/** Scores as they are written on a pairing sheet. */
export const CHESS_RESULT: Record<DbPairingResult, string> = {
  pending: "—",
  a_win: "1–0",
  b_win: "0–1",
  draw: "½–½",
  a_forfeit_win: "+ −",
  b_forfeit_win: "− +",
  double_forfeit: "− −",
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const PLAIN: Terms = {
  wording: "plain",
  chess: false,
  points: "Points",
  gamesPlayed: "Games",
  match: "match",
  matches: "matches",
  board: "Table",
  bye: "free round",
  byes: (n) => plural(n, "free round", "free rounds"),
  rematch: "played before",
  buchholz: "Opponents' strength",
  buchholzHint:
    "The points of everyone this player has faced, added up. A higher number means tougher opponents.",
  sonnebornBerger: "Quality of wins",
  sonnebornBergerHint:
    "Like opponents' strength, but each opponent counts in proportion to the games this player won against them, with draws as half.",
  record: "Won · Drawn · Lost",
  forfeits: (n) => plural(n, "game not played", "games not played"),
  resultsTitle: "Results",
  outcome: (o) => PLAIN_OUTCOME[o],
  gameResult: (result, a, b) => {
    switch (result) {
      case "pending":
        return "Not played yet";
      case "a_win":
        return `${a} won`;
      case "b_win":
        return `${b} won`;
      case "draw":
        return "Draw";
      case "a_forfeit_win":
        return `${a} won, ${b} absent`;
      case "b_forfeit_win":
        return `${b} won, ${a} absent`;
      case "double_forfeit":
        return "Both absent";
    }
  },
};

const CHESS: Terms = {
  wording: "chess",
  chess: true,
  points: "Score",
  gamesPlayed: "Played",
  match: "matchup",
  matches: "matchups",
  board: "Board",
  bye: "bye",
  byes: (n) => plural(n, "bye", "byes"),
  rematch: "rematch",
  buchholz: "Buchholz",
  buchholzHint: "Sum of the scores of every opponent faced.",
  sonnebornBerger: "Sonneborn-Berger",
  sonnebornBergerHint:
    "Opponents' scores, weighted by the share of each matchup won against them.",
  record: "W–D–L",
  forfeits: (n) => plural(n, "forfeit", "forfeits"),
  resultsTitle: "Pairings & results",
  outcome: (o) => CHESS_OUTCOME[o],
  gameResult: (result) => CHESS_RESULT[result],
};

export function termsFor(wording: Wording): Terms {
  return wording === "chess" ? CHESS : PLAIN;
}

/**
 * "Villarin, Juliana Moira" becomes "Juliana Villarin".
 *
 * The roster stores names surname-first, the way the club's sheets sort them,
 * which is right for a table and awkward in a sentence or on a button.
 */
export function shortName(fullName: string): string {
  const comma = fullName.indexOf(",");
  if (comma < 0) return fullName;
  const surname = fullName.slice(0, comma).trim();
  const given = fullName.slice(comma + 1).trim().split(/\s+/)[0] ?? "";
  return given ? `${given} ${surname}` : surname;
}

/** 1.5 rather than 1.50, and "½" where a half point reads more naturally. */
export function formatPoints(value: number): string {
  const whole = Math.floor(value);
  if (value - whole === 0.5) return whole === 0 ? "½" : `${whole}½`;
  return String(value);
}

export function ordinal(n: number): string {
  const suffix =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : n % 10 === 1
        ? "st"
        : n % 10 === 2
          ? "nd"
          : n % 10 === 3
            ? "rd"
            : "th";
  return `${n}${suffix}`;
}
