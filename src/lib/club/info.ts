/*
 * Facts about the club that the code cannot know. Officers: edit this file.
 *
 * Every value in square brackets is a placeholder and shows on the About page
 * with a dashed outline, so it is obvious what still needs filling in. Replace
 * the whole string, brackets included, and the outline goes away.
 */

export const CLUB_INFO = {
  /** One or two sentences for the About page and the home page. */
  about:
    "Chevaliers is the chess club of Philippine Science High School – Central Visayas Campus. Every club meeting is a round, everyone on the roster is paired, and this site keeps the standings as the season goes.",

  meetings: [
    { label: "When", value: "[Meeting day and time, e.g. Fridays, 3:30–5:00 pm]" },
    { label: "Where", value: "[Room or venue]" },
    { label: "Adviser", value: "[Club adviser's name]" },
  ],

  /** Steps shown under "How to join". */
  join: [
    "[How to sign up, e.g. come to any meeting or fill in a form]",
    "An officer adds your name, grade and section to the club roster.",
    "You are paired from the next round. Joining partway through the season is fine: you start on zero points, and the standings show games played next to every score.",
  ],

  /** Who to ask. Shown under the joining steps. */
  contact: "[How to reach the officers, e.g. a Facebook page or an officer's name]",
} as const;

/** True for a value that is still a placeholder. */
export function isPlaceholder(value: string): boolean {
  return value.startsWith("[") && value.endsWith("]");
}
