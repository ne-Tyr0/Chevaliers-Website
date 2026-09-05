import { createRng, Rng, shuffle } from "./rng";
import { Pairing, PieceColor, PlayerState } from "./types";

/**
 * Sort key within a score group. Higher sorts first.
 *
 * Today this reads `pairingNumber`, a persistent random integer standing in for
 * a rating. To move to Elo/Glicko-2 later, pass a `seedOf` that returns the
 * rating instead — nothing else in this file needs to change.
 */
export type SeedFn = (player: PlayerState) => number;

const defaultSeedOf: SeedFn = (p) => p.pairingNumber;

export interface PairRoundOptions {
  roundNumber: number;
  seedOf?: SeedFn;
  /** Seeded for reproducibility; pass an explicit rng in tests. */
  rng?: Rng;
}

export interface PairRoundOutcome {
  pairings: Pairing[];
  /** Who received the bye, if the checked-in count was odd. */
  byePlayerId: string | null;
  /**
   * Number of boards that had to repeat an earlier meeting.
   *
   * Normally 0. It can only be positive when the round admits no rematch-free
   * pairing at all — with a small roster the unplayed-opponent graph really can
   * run out of perfect matchings after a few rounds. The engine always uses the
   * fewest rematches possible.
   */
  forcedRematches: number;
}

/** Guard against pathological backtracking on large, heavily-constrained groups. */
const MAX_SEARCH_NODES = 200_000;

type Board = [PlayerState, PlayerState];

export class PairingError extends Error {}

/**
 * Generate one round of pairings for the checked-in players.
 *
 * Round 1 shuffles randomly. Every later round groups by cumulative score,
 * sorts each group by seed, folds top half against bottom half, and repairs
 * the result so that nobody replays an opponent.
 */
export function pairRound(
  checkedIn: readonly PlayerState[],
  options: PairRoundOptions,
): PairRoundOutcome {
  const seedOf = options.seedOf ?? defaultSeedOf;
  const rng = options.rng ?? createRng(options.roundNumber * 7919 + 13);

  if (checkedIn.length === 0) {
    return { pairings: [], byePlayerId: null, forcedRematches: 0 };
  }

  let pool = checkedIn.slice();
  let byePlayerId: string | null = null;

  if (pool.length % 2 === 1) {
    const bye = selectByePlayer(pool, seedOf, rng);
    byePlayerId = bye.id;
    pool = pool.filter((p) => p.id !== bye.id);
  }

  const boards =
    options.roundNumber === 1
      ? pairFirstRound(pool, rng)
      : pairByScoreGroups(pool, seedOf);

  const pairings = toPairings(boards, byePlayerId, rng, seedOf);

  return {
    pairings,
    byePlayerId,
    forcedRematches: pairings.filter((p) => p.isRematch).length,
  };
}

/**
 * The bye goes to the lowest-scoring player who has not had one yet this
 * season. If everyone has had one (a small club playing many rounds), fall back
 * to whoever has had the fewest.
 */
function selectByePlayer(
  pool: readonly PlayerState[],
  seedOf: SeedFn,
  rng: Rng,
): PlayerState {
  const fewestByes = Math.min(...pool.map((p) => p.byeCount));
  const eligible = pool.filter((p) => p.byeCount === fewestByes);

  const lowestScore = Math.min(...eligible.map((p) => p.score));
  const tied = eligible.filter((p) => p.score === lowestScore);

  if (tied.length === 1) return tied[0];

  // Still tied — in round 1 that is everyone, so break it randomly rather than
  // always handing the bye to the same person.
  const weakestSeed = Math.min(...tied.map(seedOf));
  const bySeed = tied.filter((p) => seedOf(p) === weakestSeed);
  return bySeed.length === 1 ? bySeed[0] : shuffle(tied, rng)[0];
}

/** Round 1: pure random pairing. */
function pairFirstRound(pool: readonly PlayerState[], rng: Rng): Board[] {
  const shuffled = shuffle(pool, rng);
  const boards: Board[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    boards.push([shuffled[i], shuffled[i + 1]]);
  }
  return boards;
}

/**
 * Rounds 2+: score groups, seed sort, fold, float, avoid rematches.
 *
 * Groups are solved in order but with backtracking, because a locally fine
 * pairing can strand the group below it. The classic case: the bottom two
 * players have already met, so the only way out is for the group above to send
 * an extra pair of players down. Committing to the first workable pairing of
 * each group in isolation cannot discover that.
 */
function pairByScoreGroups(pool: readonly PlayerState[], seedOf: SeedFn): Board[] {
  const groups = buildScoreGroups(pool, seedOf);

  const solve = (
    index: number,
    carried: readonly PlayerState[],
    budget: SearchBudget,
  ): Board[] | null => {
    if (index >= groups.length) {
      return carried.length === 0 ? [] : null;
    }

    const isLastGroup = index === groups.length - 1;
    const merged = sortForPairing([...carried, ...groups[index]], seedOf);

    for (const option of groupOptions(merged, isLastGroup, seedOf, budget)) {
      const tail = solve(index + 1, option.floated, budget);
      if (tail) return [...option.boards, ...tail];
      // `groupOptions` refunds the rematches this option spent when we ask it
      // for the next one, so the budget stays correct as we backtrack.
    }
    return null;
  };

  // Widen the search in strict priority order: first try a round with no
  // repeats and no forced color clashes at all, then allow color clashes, and
  // only once those are exhausted start allowing repeat match-ups. The first
  // combination that succeeds is therefore the least-compromised round
  // available, and a repeat is never traded for a color convenience.
  const maxBoards = Math.floor(pool.length / 2);
  for (let rematches = 0; rematches <= maxBoards; rematches++) {
    for (let clashes = 0; clashes <= maxBoards; clashes++) {
      const boards = solve(0, [], new SearchBudget(rematches, clashes));
      if (boards) return boards;
    }
  }

  throw new PairingError(
    `Unable to pair ${pool.length} players into a round at all. This should be ` +
      "impossible with an even, non-empty pool — please report it.",
  );
}

/**
 * How many compromises the current search may still spend.
 *
 * Both repeats and forced color clashes are last resorts, so the search runs
 * with hard allowances rather than soft penalties. Ordering candidates by
 * preference alone is not enough: the last two players in a group get paired
 * with each other whatever their needs, so an allowance is the only way to make
 * the search back out of a locally fine choice that strands someone later.
 */
class SearchBudget {
  constructor(
    public rematches: number,
    public hardColorClashes: number,
  ) {}
}

/** Group by exact score, highest first; each group sorted by seed descending. */
function buildScoreGroups(pool: readonly PlayerState[], seedOf: SeedFn): PlayerState[][] {
  const byScore = new Map<number, PlayerState[]>();
  for (const p of pool) {
    const list = byScore.get(p.score);
    if (list) list.push(p);
    else byScore.set(p.score, [p]);
  }

  return [...byScore.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, players]) => sortForPairing(players, seedOf));
}

/** Score descending, then seed descending, then id for a stable order. */
function sortForPairing(players: readonly PlayerState[], seedOf: SeedFn): PlayerState[] {
  return players.slice().sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const seedDiff = seedOf(b) - seedOf(a);
    if (seedDiff !== 0) return seedDiff;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

/** How many extra pairs a group may push downward before giving up. */
const MAX_EXTRA_FLOAT_PAIRS = 2;

/** Cap on float sets tried per size, so a large group cannot explode. */
const MAX_FLOAT_CANDIDATES = 200;

/**
 * Every way this group could be paired, in preference order: fewest floats
 * first, and within that, floating the players nearest the bottom of the group
 * — the conventional Swiss behaviour, where the weakest player in a group drops.
 *
 * Yielding rather than returning lets the caller reject an option that strands
 * a later group.
 */
function* groupOptions(
  pool: readonly PlayerState[],
  isLastGroup: boolean,
  seedOf: SeedFn,
  budget: SearchBudget,
): Generator<{ boards: Board[]; floated: PlayerState[] }> {
  const parity = pool.length % 2;
  // The last group has nowhere to float to, so it must pair exactly.
  const maxFloat = isLastGroup ? 0 : Math.min(pool.length, parity + MAX_EXTRA_FLOAT_PAIRS * 2);

  for (let count = parity; count <= maxFloat; count += 2) {
    for (const floatIdx of floatCandidates(pool.length, count)) {
      const remaining = pool.filter((_, i) => !floatIdx.includes(i));
      const spentRematches = budget.rematches;
      const spentClashes = budget.hardColorClashes;
      const boards = findMatching(remaining, seedOf, budget);
      if (boards) {
        yield { boards, floated: floatIdx.map((i) => pool[i]) };
        // Control came back, so the caller rejected this option. Refund what it
        // spent before trying the next one.
        budget.rematches = spentRematches;
        budget.hardColorClashes = spentClashes;
      }
    }
  }
}

/**
 * Index sets to try floating, preferring players nearest the bottom of the
 * group. `pool` is already sorted strongest-first, so higher indices are weaker.
 */
function floatCandidates(size: number, count: number): number[][] {
  if (count === 0) return [[]];
  if (count > size) return [];

  const combos: number[][] = [];
  const build = (start: number, current: number[]) => {
    if (current.length === count) {
      combos.push(current.slice());
      return;
    }
    for (let i = start; i < size; i++) {
      current.push(i);
      build(i + 1, current);
      current.pop();
    }
  };
  build(0, []);

  // Smallest total distance from the bottom of the group sorts first.
  combos.sort((a, b) => {
    const da = a.reduce((sum, i) => sum + (size - 1 - i), 0);
    const db = b.reduce((sum, i) => sum + (size - 1 - i), 0);
    return da - db;
  });
  return combos.slice(0, MAX_FLOAT_CANDIDATES);
}

/**
 * Find a perfect matching of `pool` in which nobody faces a previous opponent.
 *
 * Candidates are tried in fold order first — for a group of 2n the top player
 * prefers the player n places below, which reproduces the standard top-half vs
 * bottom-half split exactly when no rematch gets in the way. Falling back to
 * progressively more distant partners is the swap/float repair, done as a
 * search so it cannot get stuck in a partial fix.
 */
function findMatching(
  pool: readonly PlayerState[],
  seedOf: SeedFn,
  budget: SearchBudget,
): Board[] | null {
  if (pool.length % 2 !== 0) return null;

  let nodes = 0;

  const search = (remaining: readonly PlayerState[]): Board[] | null => {
    if (remaining.length === 0) return [];
    if (++nodes > MAX_SEARCH_NODES) return null;

    const anchor = remaining[0];
    const idealIndex = remaining.length / 2;

    const candidates = remaining
      .map((player, index) => ({
        player,
        index,
        rematch: anchor.opponentIds.has(player.id),
      }))
      .slice(1)
      .map((entry) => ({ ...entry, conflict: colorConflict(anchor, entry.player) }))
      .sort((a, b) => {
        // A fresh opponent always beats a repeat, however awkward the fold.
        if (a.rematch !== b.rematch) return a.rematch ? 1 : -1;

        // Forcing someone into a third straight game with the same pieces is
        // worse than bending the fold, so a hard color clash is dodged first.
        const hardA = a.conflict === 2 ? 1 : 0;
        const hardB = b.conflict === 2 ? 1 : 0;
        if (hardA !== hardB) return hardA - hardB;

        const foldDiff =
          Math.abs(a.index - idealIndex) - Math.abs(b.index - idealIndex);
        if (foldDiff !== 0) return foldDiff;

        // Same distance from the ideal fold partner: prefer the pairing whose
        // color needs complement each other.
        if (a.conflict !== b.conflict) return a.conflict - b.conflict;

        return a.index - b.index;
      });

    for (const { player, index, rematch, conflict } of candidates) {
      const hardClash = conflict === 2;
      if (rematch && budget.rematches === 0) continue;
      if (hardClash && budget.hardColorClashes === 0) continue;

      if (rematch) budget.rematches -= 1;
      if (hardClash) budget.hardColorClashes -= 1;

      const rest = remaining.filter((_, i) => i !== 0 && i !== index);
      const sub = search(rest);
      if (sub) return [[anchor, player] as Board, ...sub];

      if (rematch) budget.rematches += 1;
      if (hardClash) budget.hardColorClashes += 1;
    }

    return null;
  };

  return search(sortForPairing(pool, seedOf));
}

/**
 * How strongly a player wants White. Positive wants White, negative wants Black.
 *
 * Avoiding a third consecutive game with the same pieces dominates; keeping the
 * overall White/Black counts level comes next; simple alternation from the last
 * game is the weakest nudge.
 */
export function colorPreference(p: PlayerState): number {
  const need = absoluteColorNeed(p);
  if (need !== 0) {
    // Absolute needs outrank every soft consideration, and among them the more
    // lopsided record is the more urgent.
    return need * (100 + Math.abs(p.whiteCount - p.blackCount));
  }

  const balanceTerm = (p.blackCount - p.whiteCount) * 10;
  const alternationTerm =
    p.lastColor === "white" ? -1 : p.lastColor === "black" ? 1 : 0;
  return balanceTerm + alternationTerm;
}

/**
 * The color a player must have, if any: 1 for White, -1 for Black, 0 when they
 * have no hard need.
 *
 * Two situations make a preference absolute, matching normal Swiss practice:
 * a color difference of two or more, and two consecutive games with the same
 * pieces. Either way the player has to be given the other color.
 */
function absoluteColorNeed(p: PlayerState): number {
  const difference = p.whiteCount - p.blackCount;
  if (difference >= 2) return -1;
  if (difference <= -2) return 1;
  if (p.colorStreak >= 2 && p.lastColor) return p.lastColor === "white" ? -1 : 1;
  return 0;
}

/**
 * How badly two players' color needs collide.
 *
 * 2 — both must have the same color, so pairing them forces one into a third
 *     consecutive game with those pieces. Worth distorting the fold to avoid.
 * 1 — both merely lean the same way; one ends up slightly off balance.
 * 0 — their needs complement.
 */
function colorConflict(a: PlayerState, b: PlayerState): number {
  const needA = absoluteColorNeed(a);
  const needB = absoluteColorNeed(b);
  if (needA !== 0 && needA === needB) return 2;

  const pa = colorPreference(a);
  const pb = colorPreference(b);
  if (pa !== 0 && pb !== 0 && Math.sign(pa) === Math.sign(pb)) return 1;
  return 0;
}

/** Decide who gets White on one board. */
function assignColors(
  a: PlayerState,
  b: PlayerState,
  rng: Rng,
): { colorA: PieceColor; colorB: PieceColor } {
  const pa = colorPreference(a);
  const pb = colorPreference(b);

  let aTakesWhite: boolean;
  if (pa !== pb) {
    aTakesWhite = pa > pb;
  } else if (a.whiteCount !== b.whiteCount) {
    // Equally entitled: give White to whoever has had it less often.
    aTakesWhite = a.whiteCount < b.whiteCount;
  } else {
    // Genuinely indistinguishable. Deciding by seed here would quietly hand the
    // same players the short end every time the club met, so flip a coin.
    aTakesWhite = rng() < 0.5;
  }

  return aTakesWhite
    ? { colorA: "white", colorB: "black" }
    : { colorA: "black", colorB: "white" };
}

/** Order boards strongest-first and append the bye, then assign colors. */
function toPairings(
  boards: readonly Board[],
  byePlayerId: string | null,
  rng: Rng,
  seedOf: SeedFn,
): Pairing[] {
  const ordered = boards.slice().sort((x, y) => {
    const xScore = Math.max(x[0].score, x[1].score);
    const yScore = Math.max(y[0].score, y[1].score);
    if (yScore !== xScore) return yScore - xScore;
    return Math.max(seedOf(y[0]), seedOf(y[1])) - Math.max(seedOf(x[0]), seedOf(x[1]));
  });

  const pairings: Pairing[] = ordered.map(([a, b], i) => {
    const { colorA, colorB } = assignColors(a, b, rng);
    return {
      boardNumber: i + 1,
      playerAId: a.id,
      playerBId: b.id,
      colorA,
      colorB,
      isRematch: a.opponentIds.has(b.id),
    };
  });

  if (byePlayerId) {
    pairings.push({
      boardNumber: pairings.length + 1,
      playerAId: byePlayerId,
      playerBId: null,
      colorA: null,
      colorB: null,
      isRematch: false,
    });
  }

  return pairings;
}
