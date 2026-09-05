import {
  GameRecord,
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

/** A completed pairing row, as stored in the database. */
export interface CompletedPairing {
  roundNumber: number;
  playerAId: string;
  playerBId: string | null;
  colorA: PieceColor | null;
  colorB: PieceColor | null;
  result: "a_win" | "b_win" | "draw";
}

/**
 * Turn stored pairing rows into per-player game histories.
 *
 * This is the only bridge between database shape and engine shape, so match
 * history can stay derived from `pairings` with no separate results table.
 * Pairings whose result is still `pending` should be filtered out before
 * calling this — an unplayed game contributes nothing to score or history.
 */
export function gameRecordsByPlayer(
  pairings: readonly CompletedPairing[],
): Map<string, GameRecord[]> {
  const byPlayer = new Map<string, GameRecord[]>();

  const push = (playerId: string, record: GameRecord) => {
    const list = byPlayer.get(playerId);
    if (list) list.push(record);
    else byPlayer.set(playerId, [record]);
  };

  for (const p of pairings) {
    if (p.playerBId === null) {
      push(p.playerAId, {
        roundNumber: p.roundNumber,
        opponentId: null,
        outcome: "bye",
        color: null,
      });
      continue;
    }

    const outcomeA: PlayerOutcome =
      p.result === "draw" ? "draw" : p.result === "a_win" ? "win" : "loss";
    const outcomeB: PlayerOutcome =
      p.result === "draw" ? "draw" : p.result === "b_win" ? "win" : "loss";

    push(p.playerAId, {
      roundNumber: p.roundNumber,
      opponentId: p.playerBId,
      outcome: outcomeA,
      color: p.colorA,
    });
    push(p.playerBId, {
      roundNumber: p.roundNumber,
      opponentId: p.playerAId,
      outcome: outcomeB,
      color: p.colorB,
    });
  }

  for (const list of byPlayer.values()) {
    list.sort((a, b) => a.roundNumber - b.roundNumber);
  }
  return byPlayer;
}

/**
 * Collapse a player's season history into the state the pairing engine reads.
 *
 * A player with no games yet is perfectly valid — they enter at 0 points, which
 * is how a mid-season joiner gets slotted into the bottom score group.
 */
export function buildPlayerState(
  profile: PlayerProfileInput,
  games: readonly GameRecord[] = [],
): PlayerState {
  const ordered = games.slice().sort((a, b) => a.roundNumber - b.roundNumber);

  let score = 0;
  let gamesPlayed = 0;
  let whiteCount = 0;
  let blackCount = 0;
  let byeCount = 0;
  let lastColor: PieceColor | null = null;
  let colorStreak = 0;
  const opponentIds = new Set<string>();

  for (const g of ordered) {
    score += POINTS[g.outcome];

    if (g.outcome === "bye") {
      byeCount += 1;
      // A bye is not a game played, and it neither breaks nor extends a color
      // streak — the player simply wasn't at the board.
      continue;
    }

    gamesPlayed += 1;
    if (g.opponentId) opponentIds.add(g.opponentId);

    if (g.color === "white") {
      whiteCount += 1;
      colorStreak = lastColor === "white" ? colorStreak + 1 : 1;
      lastColor = "white";
    } else if (g.color === "black") {
      blackCount += 1;
      colorStreak = lastColor === "black" ? colorStreak + 1 : 1;
      lastColor = "black";
    }
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

/** Convenience: build state for a whole roster from stored pairings. */
export function buildPlayerStates(
  profiles: readonly PlayerProfileInput[],
  pairings: readonly CompletedPairing[],
): PlayerState[] {
  const history = gameRecordsByPlayer(pairings);
  return profiles.map((p) => buildPlayerState(p, history.get(p.id) ?? []));
}
