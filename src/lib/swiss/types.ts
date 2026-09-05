/**
 * Core types for the Swiss pairing engine.
 *
 * "Color" here always means the chess sense — which player has the White pieces
 * and which has Black. It has nothing to do with the site's visual palette.
 */

/** Which set of pieces a player has in a game. */
export type PieceColor = "white" | "black";

/** Result of a single board, from the perspective of the pairing row. */
export type GameResult =
  | "pending"
  | "a_win"
  | "b_win"
  | "draw"
  | "a_forfeit_win"
  | "b_forfeit_win"
  | "double_forfeit";

/** Result of a single game from one player's own perspective. */
export type PlayerOutcome =
  | "win"
  | "loss"
  | "draw"
  | "bye"
  | "forfeit_win"
  | "forfeit_loss"
  | "double_forfeit";

/** Points awarded per outcome. A bye and a forfeit win are both worth a full point. */
export const POINTS: Record<PlayerOutcome, number> = {
  win: 1,
  loss: 0,
  draw: 0.5,
  bye: 1,
  forfeit_win: 1,
  forfeit_loss: 0,
  double_forfeit: 0,
};

/**
 * Whether an outcome came from a game actually played at a board.
 *
 * Byes and forfeits score, but nobody sat down: they are excluded from games
 * played, from both tiebreaks, and from colour history. Getting this wrong
 * quietly inflates the standings of whoever benefited from a no-show, which is
 * exactly the kind of error nobody notices until it decides a title.
 */
export function isPlayed(outcome: PlayerOutcome): boolean {
  return outcome === "win" || outcome === "loss" || outcome === "draw";
}

/**
 * One completed game as a single player experienced it.
 * `opponentId === null` means the player took a bye that round.
 */
export interface GameRecord {
  roundNumber: number;
  opponentId: string | null;
  outcome: PlayerOutcome;
  color: PieceColor | null;
}

/**
 * Everything the pairing engine needs to know about one player, as of the
 * start of the round being paired. Built from match history by `buildPlayerState`.
 */
export interface PlayerState {
  id: string;
  /**
   * Sort key within a score group. Currently a persistent random integer
   * assigned on a player's first game — a deliberate placeholder for a rating.
   * Higher sorts first, so swapping in an Elo/Glicko number later needs no
   * other change to the algorithm. See `PairingOptions.seedOf`.
   */
  pairingNumber: number;
  score: number;
  gamesPlayed: number;
  whiteCount: number;
  blackCount: number;
  /** Color played in the player's most recent game; null if they've only had byes or none. */
  lastColor: PieceColor | null;
  /** How many consecutive recent games were played as `lastColor`. */
  colorStreak: number;
  byeCount: number;
  /** Ids of everyone this player has already faced this season. */
  opponentIds: ReadonlySet<string>;
}

/** One board in a generated round. `playerBId === null` means `playerAId` has the bye. */
export interface Pairing {
  boardNumber: number;
  playerAId: string;
  playerBId: string | null;
  colorA: PieceColor | null;
  colorB: PieceColor | null;
  /**
   * True when these two have already met this season. The engine only ever
   * produces this when no rematch-free pairing of the round exists at all,
   * which small rosters can reach after a few rounds. Surface it in the UI so
   * an officer knows it was forced rather than a bug.
   */
  isRematch: boolean;
}
