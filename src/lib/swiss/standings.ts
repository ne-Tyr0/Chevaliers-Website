import { CompletedPairing, gameRecordsByPlayer, PlayerProfileInput } from "./state";
import { GameRecord, POINTS } from "./types";

export interface StandingRow {
  playerId: string;
  score: number;
  /** Byes are excluded — this is games actually played at a board. */
  gamesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  /** Sum of opponents' current scores. */
  buchholz: number;
  /** Sum of defeated opponents' scores plus half of each drawn opponent's score. */
  sonnebornBerger: number;
  /** 1-based; players who tie on every criterion share a rank. */
  rank: number;
}

/**
 * Standings for one season, sorted by score, then Buchholz, then
 * Sonneborn-Berger.
 *
 * Because club attendance varies, `gamesPlayed` is reported alongside `score` —
 * raw points are misleading when players have sat out different numbers of
 * rounds.
 *
 * Byes are treated as a game against a ghost opponent worth 0 points, so they
 * award their full point of score without inflating either tiebreak.
 */
export function computeStandings(
  profiles: readonly PlayerProfileInput[],
  pairings: readonly CompletedPairing[],
): StandingRow[] {
  const history = gameRecordsByPlayer(pairings);

  const scores = new Map<string, number>();
  for (const profile of profiles) {
    scores.set(profile.id, totalScore(history.get(profile.id) ?? []));
  }

  // An opponent who is not in `profiles` (for instance a player removed from
  // the roster mid-season) contributes 0, the same as a bye.
  const scoreOf = (playerId: string | null): number =>
    playerId === null ? 0 : (scores.get(playerId) ?? 0);

  const rows = profiles.map((profile) => {
    const games = history.get(profile.id) ?? [];

    let wins = 0;
    let draws = 0;
    let losses = 0;
    let byes = 0;
    let buchholz = 0;
    let sonnebornBerger = 0;

    for (const game of games) {
      const opponentScore = scoreOf(game.opponentId);
      buchholz += opponentScore;

      switch (game.outcome) {
        case "win":
          wins += 1;
          sonnebornBerger += opponentScore;
          break;
        case "draw":
          draws += 1;
          sonnebornBerger += opponentScore / 2;
          break;
        case "loss":
          losses += 1;
          break;
        case "bye":
          byes += 1;
          break;
      }
    }

    return {
      playerId: profile.id,
      score: scores.get(profile.id) ?? 0,
      gamesPlayed: wins + draws + losses,
      wins,
      draws,
      losses,
      byes,
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

function totalScore(games: readonly GameRecord[]): number {
  return games.reduce((sum, game) => sum + POINTS[game.outcome], 0);
}
