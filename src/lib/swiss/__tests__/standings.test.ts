import { describe, expect, it } from "vitest";
import { computeStandings } from "../standings";
import type { CompletedMatchup } from "../state";

/** A one-game matchup, matching how rounds were recorded before three-game play. */
function single(
  roundNumber: number,
  playerAId: string,
  playerBId: string | null,
  colorA: "white" | "black" | null,
  result?: CompletedMatchup["games"][number]["result"],
): CompletedMatchup {
  return {
    roundNumber,
    playerAId,
    playerBId,
    games:
      playerBId === null || !result
        ? []
        : [{ gameNumber: 1, colorA, result }],
  };
}

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
const season: CompletedMatchup[] = [
  single(1, "ana", "bo", "white", "a_win"),
  single(1, "cy", null, null),
  single(2, "ana", "cy", "black", "draw"),
  single(2, "bo", null, null),
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
        single(1, "x", "y", "white", "draw"),
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

describe("forfeits", () => {
  const roster = [
    { id: "ana", pairingNumber: 30 },
    { id: "bo", pairingNumber: 20 },
    { id: "cy", pairingNumber: 10 },
    { id: "dee", pairingNumber: 5 },
  ];

  /**
   * ana beats bo over the board, then wins by forfeit against cy.
   * dee and cy double-forfeit, so neither scores.
   */
  const games: CompletedMatchup[] = [
    single(1, "ana", "bo", "white", "a_win"),
    single(2, "ana", "cy", "black", "a_forfeit_win"),
    single(2, "dee", "bo", "white", "double_forfeit"),
  ];

  const rows = computeStandings(roster, games);
  const row = (id: string) => rows.find((r) => r.playerId === id)!;

  it("awards a full point for a forfeit win and none for a forfeit loss", () => {
    expect(row("ana").score).toBe(2);
    expect(row("cy").score).toBe(0);
  });

  it("scores nothing for either player in a double forfeit", () => {
    expect(row("dee").score).toBe(0);
    expect(row("bo").score).toBe(0);
  });

  it("excludes forfeits from games played", () => {
    // ana played one real game; the forfeit win was not played.
    expect(row("ana").gamesPlayed).toBe(1);
    expect(row("ana").wins).toBe(1);
    expect(row("ana").forfeitWins).toBe(1);

    // bo lost one real game and had one double forfeit.
    expect(row("bo").gamesPlayed).toBe(1);
    expect(row("bo").losses).toBe(1);
    expect(row("bo").forfeitLosses).toBe(1);

    expect(row("cy").gamesPlayed).toBe(0);
    expect(row("cy").forfeitLosses).toBe(1);
    expect(row("dee").gamesPlayed).toBe(0);
    expect(row("dee").forfeitLosses).toBe(1);
  });

  it("keeps a forfeit out of Buchholz", () => {
    // ana's only played game was against bo, who has 0 points. The forfeit
    // against cy must add nothing, so Buchholz is 0 rather than cy's score.
    expect(row("ana").buchholz).toBe(0);
    // cy and dee played nobody at all.
    expect(row("cy").buchholz).toBe(0);
    expect(row("dee").buchholz).toBe(0);
  });

  it("keeps a forfeit out of Sonneborn-Berger", () => {
    // The win over bo (0 points) is worth 0, and the forfeit adds nothing.
    expect(row("ana").sonnebornBerger).toBe(0);
  });

  it("does not let a forfeit win beat a real win on tiebreak", () => {
    // A player who wins by forfeit gains score but no tiebreak credit, so two
    // players level on points are separated by who actually played.
    const contested = computeStandings(
      [
        { id: "played", pairingNumber: 2 },
        { id: "walkover", pairingNumber: 1 },
        { id: "strong", pairingNumber: 3 },
        { id: "absent", pairingNumber: 4 },
      ],
      [
        single(1, "played", "strong", "white", "a_win"),
        single(1, "walkover", "absent", "white", "a_forfeit_win"),
        single(2, "strong", "absent", "white", "a_win"),
      ],
    );

    const played = contested.find((r) => r.playerId === "played")!;
    const walkover = contested.find((r) => r.playerId === "walkover")!;

    expect(played.score).toBe(walkover.score);
    expect(played.buchholz).toBeGreaterThan(walkover.buchholz);
    expect(played.rank).toBeLessThan(walkover.rank);
  });
});
