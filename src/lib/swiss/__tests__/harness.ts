import { pairRound } from "../pairing";
import { createRng, Rng } from "../rng";
import { buildPlayerStates, CompletedPairing, PlayerProfileInput } from "../state";
import { PlayerState } from "../types";

export interface SimPlayer extends PlayerProfileInput {
  /** First round this player is eligible to be paired (1 = there from the start). */
  joinRound: number;
}

export interface SimOptions {
  rounds: number;
  seed?: number;
  /** Return false to keep a player home for a round. Defaults to full attendance. */
  attends?: (player: SimPlayer, roundNumber: number) => boolean;
}

export interface SimRound {
  roundNumber: number;
  checkedIn: string[];
  pairings: CompletedPairing[];
  byePlayerId: string | null;
  /** Boards the engine had to repeat because the round admitted nothing else. */
  forcedRematches: number;
  /** Match-ups already played before this round started. */
  metBefore: Set<string>;
}

export interface SimOutcome {
  rounds: SimRound[];
  /** Every completed pairing across the season, in round order. */
  completed: CompletedPairing[];
  /** Final season state for the whole roster. */
  finalStates: PlayerState[];
}

/** Build a roster with deterministic, well-separated pairing numbers. */
export function roster(size: number, joinRounds: Record<string, number> = {}): SimPlayer[] {
  return Array.from({ length: size }, (_, i) => {
    const id = `p${i + 1}`;
    return {
      id,
      // Descending so p1 is the top seed; the spacing keeps ties out of tests
      // that are not about ties.
      pairingNumber: (size - i) * 10,
      joinRound: joinRounds[id] ?? 1,
    };
  });
}

/**
 * Play a season. Results are decided by a seeded RNG rather than by strength,
 * so score groups shuffle around the way they do at a real club.
 */
export function simulate(players: readonly SimPlayer[], options: SimOptions): SimOutcome {
  const rng = createRng(options.seed ?? 20260905);
  const attends = options.attends ?? (() => true);
  const completed: CompletedPairing[] = [];
  const rounds: SimRound[] = [];

  for (let roundNumber = 1; roundNumber <= options.rounds; roundNumber++) {
    const present = players.filter(
      (p) => p.joinRound <= roundNumber && attends(p, roundNumber),
    );
    if (present.length < 2) continue;

    const states = buildPlayerStates(present, completed);
    const metBefore = playedMatchKeys(completed);
    const { pairings, byePlayerId, forcedRematches } = pairRound(states, {
      roundNumber,
      rng: createRng((options.seed ?? 20260905) + roundNumber),
    });

    const roundPairings = pairings.map((pairing) => ({
      roundNumber,
      playerAId: pairing.playerAId,
      playerBId: pairing.playerBId,
      colorA: pairing.colorA,
      colorB: pairing.colorB,
      result: pairing.playerBId === null ? ("a_win" as const) : decideResult(rng),
    }));

    completed.push(...roundPairings);
    rounds.push({
      roundNumber,
      checkedIn: present.map((p) => p.id),
      pairings: roundPairings,
      byePlayerId,
      forcedRematches,
      metBefore,
    });
  }

  return {
    rounds,
    completed,
    finalStates: buildPlayerStates(players, completed),
  };
}

function decideResult(rng: Rng): "a_win" | "b_win" | "draw" {
  const roll = rng();
  if (roll < 0.42) return "a_win";
  if (roll < 0.84) return "b_win";
  return "draw";
}

/** Unordered key for a match-up, for rematch detection. */
export function matchKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Every match-up played so far, as unordered keys. */
export function playedMatchKeys(completed: readonly CompletedPairing[]): Set<string> {
  const keys = new Set<string>();
  for (const p of completed) {
    if (p.playerBId === null) continue;
    keys.add(matchKey(p.playerAId, p.playerBId));
  }
  return keys;
}

/**
 * Independent brute-force check, deliberately ignorant of score groups, floats
 * and colors: is there ANY way to pair these players without a repeat?
 *
 * Used to hold the engine to the right standard — a rematch is only acceptable
 * when no rematch-free perfect matching exists at all.
 */
export function rematchFreePairingExists(
  ids: readonly string[],
  met: ReadonlySet<string>,
): boolean {
  if (ids.length % 2 !== 0) return false;
  if (ids.length === 0) return true;

  const [anchor, ...rest] = ids;
  for (const candidate of rest) {
    if (met.has(matchKey(anchor, candidate))) continue;
    if (rematchFreePairingExists(rest.filter((id) => id !== candidate), met)) {
      return true;
    }
  }
  return false;
}

/** Longest run of consecutive games with the same pieces, ignoring byes. */
export function longestColorStreak(
  playerId: string,
  completed: readonly CompletedPairing[],
): number {
  const colors: string[] = [];

  for (const p of [...completed].sort((x, y) => x.roundNumber - y.roundNumber)) {
    if (p.playerBId === null) continue;
    if (p.playerAId === playerId && p.colorA) colors.push(p.colorA);
    else if (p.playerBId === playerId && p.colorB) colors.push(p.colorB);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const color of colors) {
    run = color === previous ? run + 1 : 1;
    previous = color;
    longest = Math.max(longest, run);
  }
  return longest;
}
