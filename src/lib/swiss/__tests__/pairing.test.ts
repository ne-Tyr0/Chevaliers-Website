import { describe, expect, it } from "vitest";
import { pairRound } from "../pairing";
import { createRng } from "../rng";
import { PlayerState } from "../types";

/** Build a player state with sensible blanks, overriding only what matters. */
function player(id: string, pairingNumber: number, overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id,
    pairingNumber,
    score: 0,
    gamesPlayed: 0,
    whiteCount: 0,
    blackCount: 0,
    lastColor: null,
    colorStreak: 0,
    byeCount: 0,
    opponentIds: new Set<string>(),
    ...overrides,
  };
}

const rng = () => createRng(99);

/** Map of playerId -> opponentId for the round, ignoring colors. */
function opponentMap(pairings: { playerAId: string; playerBId: string | null }[]) {
  const map = new Map<string, string | null>();
  for (const p of pairings) {
    map.set(p.playerAId, p.playerBId);
    if (p.playerBId) map.set(p.playerBId, p.playerAId);
  }
  return map;
}

describe("round 1", () => {
  it("seats everyone and repeats nobody", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(`p${i + 1}`, (8 - i) * 10));
    const { pairings, byePlayerId } = pairRound(players, { roundNumber: 1, rng: rng() });

    expect(byePlayerId).toBeNull();
    expect(pairings).toHaveLength(4);

    const seated = pairings.flatMap((p) => [p.playerAId, p.playerBId!]);
    expect(new Set(seated).size).toBe(8);
  });

  it("hands the bye to someone when the field is odd", () => {
    const players = Array.from({ length: 7 }, (_, i) => player(`p${i + 1}`, (7 - i) * 10));
    const { pairings, byePlayerId } = pairRound(players, { roundNumber: 1, rng: rng() });

    expect(byePlayerId).not.toBeNull();
    const byeBoard = pairings.find((p) => p.playerBId === null)!;
    expect(byeBoard.playerAId).toBe(byePlayerId);
    expect(byeBoard.colorA).toBeNull();
  });

  it("does not always pick the same opening pairing", () => {
    const players = Array.from({ length: 8 }, (_, i) => player(`p${i + 1}`, (8 - i) * 10));

    const shapes = new Set<string>();
    for (let seed = 0; seed < 25; seed++) {
      const { pairings } = pairRound(players, {
        roundNumber: 1,
        rng: createRng(seed),
      });
      shapes.add(
        pairings
          .map((p) => [p.playerAId, p.playerBId].sort().join("-"))
          .sort()
          .join(","),
      );
    }
    expect(shapes.size).toBeGreaterThan(1);
  });
});

describe("score groups and the fold", () => {
  it("pairs the top half against the bottom half within a score group", () => {
    // One clean group of eight on equal points, no history to get in the way.
    const players = [80, 70, 60, 50, 40, 30, 20, 10].map((seed) =>
      player(`s${seed}`, seed, { score: 1, gamesPlayed: 1 }),
    );

    const { pairings } = pairRound(players, { roundNumber: 2, rng: rng() });
    const opponents = opponentMap(pairings);

    expect(opponents.get("s80")).toBe("s40");
    expect(opponents.get("s70")).toBe("s30");
    expect(opponents.get("s60")).toBe("s20");
    expect(opponents.get("s50")).toBe("s10");
  });

  it("pairs higher scorers against each other before lower ones", () => {
    const players = [
      player("top1", 40, { score: 2, gamesPlayed: 2 }),
      player("top2", 30, { score: 2, gamesPlayed: 2 }),
      player("low1", 20, { score: 0, gamesPlayed: 2 }),
      player("low2", 10, { score: 0, gamesPlayed: 2 }),
    ];

    const { pairings } = pairRound(players, { roundNumber: 3, rng: rng() });
    const opponents = opponentMap(pairings);

    expect(opponents.get("top1")).toBe("top2");
    expect(opponents.get("low1")).toBe("low2");
  });

  it("floats a player down when a score group has an odd size", () => {
    // Three on 1 point, one on 0: the weakest of the trio must drop.
    const players = [
      player("a", 40, { score: 1, gamesPlayed: 1 }),
      player("b", 30, { score: 1, gamesPlayed: 1 }),
      player("c", 20, { score: 1, gamesPlayed: 1 }),
      player("d", 10, { score: 0, gamesPlayed: 1 }),
    ];

    const { pairings } = pairRound(players, { roundNumber: 2, rng: rng() });
    const opponents = opponentMap(pairings);

    expect(opponents.get("a")).toBe("b");
    expect(opponents.get("c")).toBe("d");
  });

  it("slots a mid-season joiner into the bottom group at zero points", () => {
    const players = [
      player("vet1", 50, { score: 2, gamesPlayed: 2 }),
      player("vet2", 40, { score: 2, gamesPlayed: 2 }),
      player("vet3", 30, { score: 0, gamesPlayed: 2 }),
      player("newcomer", 20, { score: 0, gamesPlayed: 0 }),
    ];

    const { pairings } = pairRound(players, { roundNumber: 3, rng: rng() });
    const opponents = opponentMap(pairings);

    // The newcomer joins the zero-point group rather than facing the leaders.
    expect(opponents.get("newcomer")).toBe("vet3");
    expect(opponents.get("vet1")).toBe("vet2");
  });
});

describe("rematch avoidance", () => {
  it("breaks the fold rather than repeat a game", () => {
    // The ideal fold would be a-c and b-d, but a and c have already met.
    const players = [
      player("a", 40, { score: 1, gamesPlayed: 1, opponentIds: new Set(["c"]) }),
      player("b", 30, { score: 1, gamesPlayed: 1 }),
      player("c", 20, { score: 1, gamesPlayed: 1, opponentIds: new Set(["a"]) }),
      player("d", 10, { score: 1, gamesPlayed: 1 }),
    ];

    const { pairings, forcedRematches } = pairRound(players, {
      roundNumber: 2,
      rng: rng(),
    });
    const opponents = opponentMap(pairings);

    expect(forcedRematches).toBe(0);
    expect(opponents.get("a")).not.toBe("c");
    expect(pairings.every((p) => !p.isRematch)).toBe(true);
  });

  it("pulls players down from the group above to rescue an unpairable bottom group", () => {
    // The two on zero have already met, so the pair above them has to split up
    // and come down rather than leave the bottom group stuck.
    const players = [
      player("a", 40, { score: 1, gamesPlayed: 1 }),
      player("b", 30, { score: 1, gamesPlayed: 1 }),
      player("c", 20, { score: 0, gamesPlayed: 1, opponentIds: new Set(["d"]) }),
      player("d", 10, { score: 0, gamesPlayed: 1, opponentIds: new Set(["c"]) }),
    ];

    const { pairings, forcedRematches } = pairRound(players, {
      roundNumber: 2,
      rng: rng(),
    });
    const opponents = opponentMap(pairings);

    expect(forcedRematches).toBe(0);
    expect(opponents.get("c")).not.toBe("d");
  });

  it("reports a repeat as forced when the round genuinely admits nothing else", () => {
    // Everyone has played everyone: a repeat is unavoidable.
    const ids = ["a", "b", "c", "d"];
    const players = ids.map((id, i) =>
      player(id, (4 - i) * 10, {
        score: 1,
        gamesPlayed: 3,
        opponentIds: new Set(ids.filter((other) => other !== id)),
      }),
    );

    const { pairings, forcedRematches } = pairRound(players, {
      roundNumber: 4,
      rng: rng(),
    });

    expect(forcedRematches).toBe(2);
    expect(pairings.filter((p) => p.isRematch)).toHaveLength(2);
  });
});

describe("byes", () => {
  it("goes to the lowest scorer who has not had one", () => {
    const players = [
      player("leader", 50, { score: 3, gamesPlayed: 3 }),
      player("middle", 40, { score: 2, gamesPlayed: 3 }),
      player("tail", 30, { score: 1, gamesPlayed: 3 }),
      player("alsoTail", 20, { score: 2, gamesPlayed: 3 }),
      player("bottom", 10, { score: 0, gamesPlayed: 3 }),
    ];

    const { byePlayerId } = pairRound(players, { roundNumber: 4, rng: rng() });
    expect(byePlayerId).toBe("bottom");
  });

  it("skips someone who already had a bye, even if they are last", () => {
    const players = [
      player("leader", 50, { score: 3, gamesPlayed: 3 }),
      player("middle", 40, { score: 2, gamesPlayed: 3 }),
      player("tail", 30, { score: 1, gamesPlayed: 3 }),
      player("alsoTail", 20, { score: 2, gamesPlayed: 3 }),
      player("bottom", 10, { score: 0, gamesPlayed: 2, byeCount: 1 }),
    ];

    const { byePlayerId } = pairRound(players, { roundNumber: 4, rng: rng() });
    expect(byePlayerId).toBe("tail");
  });

  it("falls back to the fewest byes once everyone has had one", () => {
    const players = [
      player("a", 30, { score: 2, gamesPlayed: 3, byeCount: 2 }),
      player("b", 20, { score: 1, gamesPlayed: 3, byeCount: 1 }),
      player("c", 10, { score: 3, gamesPlayed: 3, byeCount: 1 }),
    ];

    const { byePlayerId } = pairRound(players, { roundNumber: 5, rng: rng() });
    // Both b and c have had one bye; b is the lower scorer of the two.
    expect(byePlayerId).toBe("b");
  });
});

describe("colors", () => {
  it("alternates from the previous round where it can", () => {
    const players = [
      player("a", 40, {
        score: 1,
        gamesPlayed: 1,
        whiteCount: 1,
        lastColor: "white",
        colorStreak: 1,
      }),
      player("b", 30, {
        score: 1,
        gamesPlayed: 1,
        blackCount: 1,
        lastColor: "black",
        colorStreak: 1,
      }),
    ];

    const { pairings } = pairRound(players, { roundNumber: 2, rng: rng() });
    const board = pairings[0];
    const colorOf = (id: string) =>
      board.playerAId === id ? board.colorA : board.colorB;

    expect(colorOf("a")).toBe("black");
    expect(colorOf("b")).toBe("white");
  });

  it("honours an absolute preference after two games with the same pieces", () => {
    const players = [
      player("streaky", 40, {
        score: 2,
        gamesPlayed: 2,
        whiteCount: 2,
        lastColor: "white",
        colorStreak: 2,
      }),
      player("even", 30, {
        score: 2,
        gamesPlayed: 2,
        whiteCount: 1,
        blackCount: 1,
        lastColor: "black",
        colorStreak: 1,
      }),
    ];

    const { pairings } = pairRound(players, { roundNumber: 3, rng: rng() });
    const board = pairings[0];
    const colorOf = (id: string) =>
      board.playerAId === id ? board.colorA : board.colorB;

    expect(colorOf("streaky")).toBe("black");
  });

  it("avoids pairing two players who both need the same color", () => {
    // a and b both need Black; c and d both need White. Pairing a-b would force
    // one of them into a third straight White, so the engine should cross them.
    const needsBlack = (id: string, seed: number) =>
      player(id, seed, {
        score: 1,
        gamesPlayed: 2,
        whiteCount: 2,
        lastColor: "white" as const,
        colorStreak: 2,
      });
    const needsWhite = (id: string, seed: number) =>
      player(id, seed, {
        score: 1,
        gamesPlayed: 2,
        blackCount: 2,
        lastColor: "black" as const,
        colorStreak: 2,
      });

    const players = [
      needsBlack("a", 40),
      needsBlack("b", 30),
      needsWhite("c", 20),
      needsWhite("d", 10),
    ];

    const { pairings } = pairRound(players, { roundNumber: 3, rng: rng() });
    const opponents = opponentMap(pairings);

    expect(opponents.get("a")).not.toBe("b");
    expect(opponents.get("c")).not.toBe("d");

    for (const board of pairings) {
      expect([board.colorA, board.colorB].sort()).toEqual(["black", "white"]);
    }
  });
});

describe("edge cases", () => {
  it("returns nothing for an empty field", () => {
    const { pairings, byePlayerId } = pairRound([], { roundNumber: 1, rng: rng() });
    expect(pairings).toEqual([]);
    expect(byePlayerId).toBeNull();
  });

  it("gives a single attendee the bye", () => {
    const { pairings, byePlayerId } = pairRound([player("solo", 10)], {
      roundNumber: 1,
      rng: rng(),
    });
    expect(byePlayerId).toBe("solo");
    expect(pairings).toHaveLength(1);
    expect(pairings[0].playerBId).toBeNull();
  });

  it("numbers boards from one, with the bye last", () => {
    const players = Array.from({ length: 5 }, (_, i) => player(`p${i + 1}`, (5 - i) * 10));
    const { pairings } = pairRound(players, { roundNumber: 1, rng: rng() });

    expect(pairings.map((p) => p.boardNumber)).toEqual([1, 2, 3]);
    expect(pairings.at(-1)!.playerBId).toBeNull();
  });

  it("accepts a rating-style seed without any other change", () => {
    // The point of `seedOf`: swapping the placeholder for a real rating later
    // should not need the algorithm touched.
    const players = [
      player("strong", 1, { score: 1, gamesPlayed: 1 }),
      player("solid", 2, { score: 1, gamesPlayed: 1 }),
      player("okay", 3, { score: 1, gamesPlayed: 1 }),
      player("novice", 4, { score: 1, gamesPlayed: 1 }),
    ];
    const ratings: Record<string, number> = {
      strong: 1800,
      solid: 1600,
      okay: 1400,
      novice: 1200,
    };

    const { pairings } = pairRound(players, {
      roundNumber: 2,
      rng: rng(),
      seedOf: (p) => ratings[p.id],
    });
    const opponents = opponentMap(pairings);

    // Folded by rating: 1800 v 1400 and 1600 v 1200.
    expect(opponents.get("strong")).toBe("okay");
    expect(opponents.get("solid")).toBe("novice");
  });
});
