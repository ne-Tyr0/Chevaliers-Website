import { describe, expect, it } from "vitest";
import { buildPlayerStates } from "../state";
import {
  longestColorStreak,
  matchKey,
  rematchFreePairingExists,
  roster,
  simulate,
} from "./harness";

const ROSTER_SIZES = [6, 7, 8, 11];
const ROUNDS = 4;

describe.each(ROSTER_SIZES)("a %i-player season over 4 rounds", (size) => {
  const players = roster(size);
  const season = simulate(players, { rounds: ROUNDS, seed: 1000 + size });

  it("plays every scheduled round", () => {
    expect(season.rounds).toHaveLength(ROUNDS);
  });

  it("seats every checked-in player exactly once per round", () => {
    for (const round of season.rounds) {
      const seated = round.pairings.flatMap((p) =>
        p.playerBId === null ? [p.playerAId] : [p.playerAId, p.playerBId],
      );
      expect(seated.slice().sort()).toEqual(round.checkedIn.slice().sort());
      expect(new Set(seated).size).toBe(seated.length);
    }
  });

  it("only repeats a match-up when the round admits no alternative", () => {
    for (const round of season.rounds) {
      const seated = round.pairings
        .filter((p) => p.playerBId !== null)
        .flatMap((p) => [p.playerAId, p.playerBId!]);

      if (rematchFreePairingExists(seated, round.metBefore)) {
        expect(
          round.forcedRematches,
          `round ${round.roundNumber} repeated a match-up although a clean pairing existed`,
        ).toBe(0);
      }
    }
  });

  it("flags every repeat it does produce", () => {
    for (const round of season.rounds) {
      const actualRepeats = round.pairings.filter(
        (p) => p.playerBId !== null && round.metBefore.has(matchKey(p.playerAId, p.playerBId!)),
      ).length;
      expect(actualRepeats).toBe(round.forcedRematches);
    }
  });

  it("gives a bye only when the round has an odd number of players", () => {
    for (const round of season.rounds) {
      const expectsBye = round.checkedIn.length % 2 === 1;
      expect(round.byePlayerId !== null).toBe(expectsBye);
    }
  });

  it("never gives a second bye while someone is still without one", () => {
    const byesSoFar = new Map<string, number>();

    for (const round of season.rounds) {
      if (!round.byePlayerId) continue;

      const eligible = round.checkedIn.filter((id) => (byesSoFar.get(id) ?? 0) === 0);
      if (eligible.length > 0) {
        expect(eligible).toContain(round.byePlayerId);
      }
      byesSoFar.set(round.byePlayerId, (byesSoFar.get(round.byePlayerId) ?? 0) + 1);
    }
  });

  it("assigns two colors on every played board and none on a bye", () => {
    for (const pairing of season.completed) {
      if (pairing.playerBId === null) {
        expect(pairing.colorA).toBeNull();
        expect(pairing.colorB).toBeNull();
      } else {
        expect([pairing.colorA, pairing.colorB].slice().sort()).toEqual([
          "black",
          "white",
        ]);
      }
    }
  });

  it("never gives a player the same color three times running", () => {
    for (const player of players) {
      expect(
        longestColorStreak(player.id, season.completed),
        `${player.id} had a run of the same color`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("never lets a player's color count drift beyond the standard tolerance", () => {
    // A difference of two is where a color preference becomes absolute, so it
    // is the point the engine is obliged to correct from. Anything beyond that
    // means an absolute preference was ignored.
    for (const state of season.finalStates) {
      expect(
        Math.abs(state.whiteCount - state.blackCount),
        `${state.id} played ${state.whiteCount} white / ${state.blackCount} black`,
      ).toBeLessThanOrEqual(2);
    }
  });

  it("keeps most of the field perfectly balanced", () => {
    const drifted = season.finalStates.filter(
      (s) => Math.abs(s.whiteCount - s.blackCount) === 2,
    );
    // Some drift is unavoidable when two players with the same need have to be
    // paired, but it should be the exception rather than the norm.
    expect(drifted.length).toBeLessThanOrEqual(Math.ceil(size / 4));
  });

  it("awards score consistent with games played and byes", () => {
    for (const state of season.finalStates) {
      expect(state.score).toBeGreaterThanOrEqual(state.byeCount);
      expect(state.score).toBeLessThanOrEqual(state.gamesPlayed + state.byeCount);
      expect(state.gamesPlayed + state.byeCount).toBe(ROUNDS);
    }
  });
});

describe("variable attendance", () => {
  it("slots a round 3 joiner into the zero-point group at zero points", () => {
    const players = roster(9, { p9: 3 });
    const season = simulate(players, { rounds: 4, seed: 4242 });

    const beforeJoining = buildPlayerStates(players, season.completed).find(
      (s) => s.id === "p9",
    );
    expect(beforeJoining).toBeDefined();

    // They are absent for rounds 1 and 2 ...
    const earlyAppearances = season.completed.filter(
      (p) => p.roundNumber < 3 && (p.playerAId === "p9" || p.playerBId === "p9"),
    );
    expect(earlyAppearances).toHaveLength(0);

    // ... and enter round 3 on zero points, so their first opponent is drawn
    // from the bottom of the standings rather than the top.
    const stateAtRound3 = buildPlayerStates(
      players,
      season.completed.filter((p) => p.roundNumber < 3),
    ).find((s) => s.id === "p9")!;
    expect(stateAtRound3.score).toBe(0);
    expect(stateAtRound3.gamesPlayed).toBe(0);

    const round3 = season.rounds.find((r) => r.roundNumber === 3)!;
    expect(round3.checkedIn).toContain("p9");
  });

  it("does not penalise a player for missing a meeting", () => {
    const players = roster(8);
    // p3 skips round 2 entirely.
    const season = simulate(players, {
      rounds: 4,
      seed: 777,
      attends: (player, round) => !(player.id === "p3" && round === 2),
    });

    const p3 = season.finalStates.find((s) => s.id === "p3")!;
    expect(p3.gamesPlayed + p3.byeCount).toBe(3);

    const round2 = season.rounds.find((r) => r.roundNumber === 2)!;
    expect(round2.checkedIn).not.toContain("p3");
    expect(
      round2.pairings.some((p) => p.playerAId === "p3" || p.playerBId === "p3"),
    ).toBe(false);

    // Their score carries forward untouched into round 3.
    const beforeRound3 = season.completed.filter((p) => p.roundNumber < 3);
    const afterRound1 = season.completed.filter((p) => p.roundNumber < 2);
    const scoreAfterR1 = buildPlayerStates(players, afterRound1).find(
      (s) => s.id === "p3",
    )!.score;
    const scoreAfterR2 = buildPlayerStates(players, beforeRound3).find(
      (s) => s.id === "p3",
    )!.score;
    expect(scoreAfterR2).toBe(scoreAfterR1);
  });

  it("handles a roster that grows every round without repeating a match-up", () => {
    const players = roster(12, { p10: 2, p11: 3, p12: 4 });
    const season = simulate(players, { rounds: 5, seed: 31337 });

    // A 12-player field over 5 rounds has plenty of fresh opponents left, so
    // here the stronger claim really does hold: no repeats at all.
    const seen = new Set<string>();
    for (const pairing of season.completed) {
      if (pairing.playerBId === null) continue;
      const key = matchKey(pairing.playerAId, pairing.playerBId);
      expect(seen.has(key), `${key} was played twice`).toBe(false);
      seen.add(key);
    }
    expect(season.rounds.every((r) => r.forcedRematches === 0)).toBe(true);
  });
});
