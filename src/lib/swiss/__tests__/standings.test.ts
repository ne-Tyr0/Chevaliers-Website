import { describe, expect, it } from "vitest";
import { computeStandings } from "../standings";
import { CompletedPairing } from "../state";

const profiles = [
  { id: "ana", pairingNumber: 30 },
  { id: "bo", pairingNumber: 20 },
  { id: "cy", pairingNumber: 10 },
];

/**
 * A tiny worked season, small enough to check the tiebreak arithmetic by hand.
 *
 * Round 1: ana beats bo, cy sits out with a bye.
 * Round 2: ana draws cy, bo sits out with a bye.
 *
 * Final scores — ana 1.5, bo 1.0 (bye only), cy 1.5.
 */
const season: CompletedPairing[] = [
  {
    roundNumber: 1,
    playerAId: "ana",
    playerBId: "bo",
    colorA: "white",
    colorB: "black",
    result: "a_win",
  },
  {
    roundNumber: 1,
    playerAId: "cy",
    playerBId: null,
    colorA: null,
    colorB: null,
    result: "a_win",
  },
  {
    roundNumber: 2,
    playerAId: "ana",
    playerBId: "cy",
    colorA: "black",
    colorB: "white",
    result: "draw",
  },
  {
    roundNumber: 2,
    playerAId: "bo",
    playerBId: null,
    colorA: null,
    colorB: null,
    result: "a_win",
  },
];

describe("computeStandings", () => {
  const rows = computeStandings(profiles, season);
  const row = (id: string) => rows.find((r) => r.playerId === id)!;

  it("scores a win at 1, a draw at 0.5 and a bye at 1", () => {
    expect(row("ana").score).toBe(1.5);
    expect(row("bo").score).toBe(1);
    expect(row("cy").score).toBe(1.5);
  });

  it("counts a bye separately from games played", () => {
    expect(row("bo").gamesPlayed).toBe(1);
    expect(row("bo").byes).toBe(1);
    expect(row("cy").gamesPlayed).toBe(1);
    expect(row("cy").byes).toBe(1);
    expect(row("ana").gamesPlayed).toBe(2);
    expect(row("ana").byes).toBe(0);
  });

  it("sums opponents' scores for Buchholz", () => {
    // ana faced bo (1.0) and cy (1.5).
    expect(row("ana").buchholz).toBe(2.5);
  });

  it("treats a bye as a ghost opponent worth zero for Buchholz", () => {
    // bo faced ana (1.5) and took a bye, which must add nothing.
    expect(row("bo").buchholz).toBe(1.5);
    expect(row("cy").buchholz).toBe(1.5);
  });

  it("sums defeated opponents in full and drawn opponents by half for Sonneborn-Berger", () => {
    // ana beat bo (1.0) and drew with cy (1.5) -> 1.0 + 0.75.
    expect(row("ana").sonnebornBerger).toBe(1.75);
    // cy drew with ana (1.5) -> 0.75, and the bye adds nothing.
    expect(row("cy").sonnebornBerger).toBe(0.75);
    // bo lost their only game; the bye must not inflate this either.
    expect(row("bo").sonnebornBerger).toBe(0);
  });

  it("orders by score, then Buchholz, then Sonneborn-Berger", () => {
    expect(rows.map((r) => r.playerId)).toEqual(["ana", "cy", "bo"]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("gives players who tie on every criterion the same rank", () => {
    const tied = computeStandings(
      [
        { id: "x", pairingNumber: 1 },
        { id: "y", pairingNumber: 2 },
      ],
      [
        {
          roundNumber: 1,
          playerAId: "x",
          playerBId: "y",
          colorA: "white",
          colorB: "black",
          result: "draw",
        },
      ],
    );
    expect(tied.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("reports a player with no games at all rather than dropping them", () => {
    const withNewcomer = computeStandings(
      [...profiles, { id: "dee", pairingNumber: 5 }],
      season,
    );
    const dee = withNewcomer.find((r) => r.playerId === "dee")!;
    expect(dee.score).toBe(0);
    expect(dee.gamesPlayed).toBe(0);
    expect(dee.buchholz).toBe(0);
    expect(dee.rank).toBe(4);
  });

  it("ignores a bye when ranking, so it cannot buy a tiebreak advantage", () => {
    // bo and cy both took one bye, but cy also earned half a point against a
    // real opponent, so cy must finish ahead.
    expect(row("cy").rank).toBeLessThan(row("bo").rank);
  });
});
