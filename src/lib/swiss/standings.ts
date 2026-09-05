import { CompletedMatchup, playerHistory, PlayerProfileInput } from "./state";
import { isPlayed } from "./types";

export interface StandingRow {
  playerId: string;
  /** Game points: every game of every matchup counts. */
  score: number;
  /** Games actually played at a board; byes and forfeits are excluded. */
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  /** Matchups sat out. */
  byes: number;
  /** Games won without playing, because the opponent did not appear. */
  forfeitWins: number;
  /** Games lost without playing, including a double forfeit. */
  forfeitLosses: number;
  /** Sum of the scores of opponents actually faced, once per matchup. */
  buchholz: number;
  /** Opponents' scores weighted by the share of each matchup won against them. */
  sonnebornBerger: number;
  /** 1-based; players who tie on every criterion share a rank. */
  rank: number;
}

/**
 * Standings for one season, sorted by score, then Buchholz, then
 * Sonneborn-Berger.
 *
 * Score is game points, so a 2-1 matchup is worth 2 rather than 1.
 *
 * Both tiebreaks are computed per matchup, not per game. Buchholz adds an
 * opponent's score once for the matchup, and Sonneborn-Berger weights it by the
 * share of that matchup won — so beating a strong opponent 3-0 counts for more
 * than scraping 2-1, and with one game per matchup it reduces to the ordinary
 * definition. That keeps rounds recorded before the club moved to three-game
 * matchups scoring on the same basis as the ones after.
 *
 * Byes and forfeits are unplayed, so they award their points but contribute
 * nothing to either tiebreak and nothing to games played.
 */
export function computeStandings(
  profiles: readonly PlayerProfileInput[],
  matchups: readonly CompletedMatchup[],
): StandingRow[] {
  const history = playerHistory(matchups);

  const scores = new Map<string, number>();
  for (const profile of profiles) {
    const encounters = history.get(profile.id)?.encounters ?? [];
    scores.set(
      profile.id,
      encounters.reduce((sum, e) => sum + e.points, 0),
    );
  }

  // An opponent who is not in `profiles` — someone removed from the roster
  // mid-season — contributes 0, the same as a bye.
  const scoreOf = (playerId: string | null): number =>
    playerId === null ? 0 : (scores.get(playerId) ?? 0);

  const rows = profiles.map((profile) => {
    const entry = history.get(profile.id);
    const games = entry?.games ?? [];
    const encounters = entry?.encounters ?? [];

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let forfeitWins = 0;
    let forfeitLosses = 0;

    for (const game of games) {
      switch (game.outcome) {
        case "win":
          wins += 1;
          break;
        case "draw":
          draws += 1;
          break;
        case "loss":
          losses += 1;
          break;
        case "forfeit_win":
          forfeitWins += 1;
          break;
        case "forfeit_loss":
        case "double_forfeit":
          forfeitLosses += 1;
          break;
      }
    }

    let byes = 0;
    let buchholz = 0;
    let sonnebornBerger = 0;

    for (const encounter of encounters) {
      if (encounter.opponentId === null) {
        byes += 1;
        continue;
      }
      // A matchup where nothing was actually played is not a played game, so it
      // stays out of both tiebreaks entirely.
      if (encounter.playedCount === 0) continue;

      const opponentScore = scoreOf(encounter.opponentId);
      buchholz += opponentScore;
      sonnebornBerger +=
        opponentScore * (encounter.playedPoints / encounter.playedCount);
    }

    return {
      playerId: profile.id,
      score: scores.get(profile.id) ?? 0,
      gamesPlayed: games.filter((g) => isPlayed(g.outcome)).length,
      wins,
      draws,
      losses,
      byes,
      forfeitWins,
      forfeitLosses,
      buchholz,
      sonnebornBerger,
      rank: 0,
    } satisfies StandingRow;
  });

  rows.sort(compareStandings);

  let rank = 0;
  rows.forEach((row, index) => {
    const previous = rows[index - 1];
    if (!previous || compareStandings(previous, row) !== 0) rank = index + 1;
    row.rank = rank;
  });

  return rows;
}

function compareStandings(a: StandingRow, b: StandingRow): number {
  if (b.score !== a.score) return b.score - a.score;
  if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
  if (b.sonnebornBerger !== a.sonnebornBerger) {
    return b.sonnebornBerger - a.sonnebornBerger;
  }
  return 0;
}
