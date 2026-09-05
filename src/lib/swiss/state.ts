import {
  GameRecord,
  GAMES_PER_MATCHUP,
  isPlayed,
  PieceColor,
  PlayerOutcome,
  PlayerState,
  POINTS,
} from "./types";

/** The persisted profile fields the engine cares about. */
export interface PlayerProfileInput {
  id: string;
  pairingNumber: number;
}

/** One game inside a matchup, as stored. */
export interface MatchupGame {
  gameNumber: number;
  /** Which pieces player A had. Null only on legacy rows with no colour recorded. */
  colorA: PieceColor | null;
  result:
    | "a_win"
    | "b_win"
    | "draw"
    | "a_forfeit_win"
    | "b_forfeit_win"
    | "double_forfeit";
}

/**
 * A completed pairing: two players and the games they played against each
 * other. `playerBId === null` is a bye, which has no games.
 *
 * The number of games is read from the data rather than assumed, so rounds
 * recorded before the club moved to three-game matchups still score correctly.
 */
export interface CompletedMatchup {
  roundNumber: number;
  playerAId: string;
  playerBId: string | null;
  games: readonly MatchupGame[];
}

/** One player's side of a single matchup. */
export interface Encounter {
  roundNumber: number;
  /** Null for a bye. */
  opponentId: string | null;
  /** Every point taken from the matchup, forfeits included. */
  points: number;
  /** Points from games actually played at the board. */
  playedPoints: number;
  /** How many of the matchup's games were actually played. */
  playedCount: number;
  /** How many games the matchup contained at all. */
  gameCount: number;
}

export interface PlayerHistory {
  /** One entry per game, for colours, form and win/draw/loss counts. */
  games: GameRecord[];
  /** One entry per matchup, for score and both tiebreaks. */
  encounters: Encounter[];
}

/** Both players' outcomes for each way a single game can end. */
const OUTCOMES: Record<
  MatchupGame["result"],
  { a: PlayerOutcome; b: PlayerOutcome }
> = {
  a_win: { a: "win", b: "loss" },
  b_win: { a: "loss", b: "win" },
  draw: { a: "draw", b: "draw" },
  a_forfeit_win: { a: "forfeit_win", b: "forfeit_loss" },
  b_forfeit_win: { a: "forfeit_loss", b: "forfeit_win" },
  double_forfeit: { a: "double_forfeit", b: "double_forfeit" },
};

const other = (color: PieceColor | null): PieceColor | null =>
  color === "white" ? "black" : color === "black" ? "white" : null;

/**
 * Turn stored matchups into per-player history.
 *
 * This is the only bridge between database shape and engine shape, so match
 * history stays derived rather than duplicated.
 */
export function playerHistory(
  matchups: readonly CompletedMatchup[],
): Map<string, PlayerHistory> {
  const byPlayer = new Map<string, PlayerHistory>();

  const entry = (playerId: string): PlayerHistory => {
    const existing = byPlayer.get(playerId);
    if (existing) return existing;
    const created: PlayerHistory = { games: [], encounters: [] };
    byPlayer.set(playerId, created);
    return created;
  };

  // A bye is worth a whole matchup, so sitting out costs nothing relative to
  // the players who won theirs. How much that is depends on the round: rounds
  // recorded before the club moved to three-game matchups hold a single game,
  // and crediting three points for a bye there would be a gift.
  const byeValueByRound = new Map<number, number>();
  for (const matchup of matchups) {
    if (matchup.playerBId === null) continue;
    byeValueByRound.set(
      matchup.roundNumber,
      Math.max(byeValueByRound.get(matchup.roundNumber) ?? 0, matchup.games.length),
    );
  }

  for (const matchup of matchups) {
    if (matchup.playerBId === null) {
      const value = byeValueByRound.get(matchup.roundNumber) || GAMES_PER_MATCHUP;
      entry(matchup.playerAId).encounters.push({
        roundNumber: matchup.roundNumber,
        opponentId: null,
        points: value,
        playedPoints: 0,
        playedCount: 0,
        gameCount: 0,
      });
      continue;
    }

    const sides = [
      { self: matchup.playerAId, opponent: matchup.playerBId, isA: true },
      { self: matchup.playerBId, opponent: matchup.playerAId, isA: false },
    ];

    for (const side of sides) {
      const history = entry(side.self);
      let points = 0;
      let playedPoints = 0;
      let playedCount = 0;

      for (const game of matchup.games) {
        const outcome = side.isA
          ? OUTCOMES[game.result].a
          : OUTCOMES[game.result].b;
        const value = POINTS[outcome];
        points += value;
        if (isPlayed(outcome)) {
          playedPoints += value;
          playedCount += 1;
        }

        history.games.push({
          roundNumber: matchup.roundNumber,
          opponentId: side.opponent,
          outcome,
          color: side.isA ? game.colorA : other(game.colorA),
        });
      }

      history.encounters.push({
        roundNumber: matchup.roundNumber,
        opponentId: side.opponent,
        points,
        playedPoints,
        playedCount,
        gameCount: matchup.games.length,
      });
    }
  }

  for (const history of byPlayer.values()) {
    history.games.sort(
      (a, b) => a.roundNumber - b.roundNumber || compareGames(a, b),
    );
    history.encounters.sort((a, b) => a.roundNumber - b.roundNumber);
  }
  return byPlayer;
}

function compareGames(a: GameRecord, b: GameRecord): number {
  return (a.opponentId ?? "").localeCompare(b.opponentId ?? "");
}

/**
 * Collapse a player's season history into the state the pairing engine reads.
 *
 * A player with no games yet is perfectly valid — they enter at 0 points, which
 * is how a mid-season joiner gets slotted into the bottom score group.
 */
export function buildPlayerState(
  profile: PlayerProfileInput,
  history: PlayerHistory = { games: [], encounters: [] },
): PlayerState {
  let whiteCount = 0;
  let blackCount = 0;
  let gamesPlayed = 0;
  let lastColor: PieceColor | null = null;
  let colorStreak = 0;

  for (const game of history.games) {
    if (!isPlayed(game.outcome)) continue;
    gamesPlayed += 1;

    if (game.color === "white") {
      whiteCount += 1;
      colorStreak = lastColor === "white" ? colorStreak + 1 : 1;
      lastColor = "white";
    } else if (game.color === "black") {
      blackCount += 1;
      colorStreak = lastColor === "black" ? colorStreak + 1 : 1;
      lastColor = "black";
    }
  }

  let score = 0;
  let byeCount = 0;
  const opponentIds = new Set<string>();
  for (const encounter of history.encounters) {
    score += encounter.points;
    if (encounter.opponentId === null) byeCount += 1;
    // Being paired counts as having met, even if every game was forfeited, so
    // the engine will not keep pairing the same two people around a no-show.
    else opponentIds.add(encounter.opponentId);
  }

  return {
    id: profile.id,
    pairingNumber: profile.pairingNumber,
    score,
    gamesPlayed,
    whiteCount,
    blackCount,
    lastColor,
    colorStreak,
    byeCount,
    opponentIds,
  };
}

/** Convenience: build state for a whole roster from stored matchups. */
export function buildPlayerStates(
  profiles: readonly PlayerProfileInput[],
  matchups: readonly CompletedMatchup[],
): PlayerState[] {
  const history = playerHistory(matchups);
  return profiles.map((p) => buildPlayerState(p, history.get(p.id)));
}
