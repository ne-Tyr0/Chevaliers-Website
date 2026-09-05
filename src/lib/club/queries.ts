import { createPublicClient } from "@/lib/supabase/server";
import type {
  GameRow,
  PairingRow,
  PlayerRow,
  RoundRow,
  SeasonRow,
} from "@/lib/supabase/database.types";
import type { CompletedMatchup, MatchupGame, PlayerProfileInput } from "@/lib/swiss";

/** A matchup together with its games, which is how the UI always wants it. */
export interface MatchupView {
  pairing: PairingRow;
  games: GameRow[];
}

export async function getActiveSeason(): Promise<SeasonRow | null> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("seasons")
    .select("*")
    .eq("status", "active")
    .maybeSingle();
  return data ?? null;
}

export async function getSeasonRounds(seasonId: string): Promise<RoundRow[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("rounds")
    .select("*")
    .eq("season_id", seasonId)
    .order("round_number", { ascending: true });
  return data ?? [];
}

/** The club roster, active members first, alphabetically within each group. */
export async function getRoster(): Promise<PlayerRow[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true });
  return data ?? [];
}

export interface SeasonHistory {
  rounds: RoundRow[];
  /** Every matchup of the season, with its games attached. */
  matchupViews: MatchupView[];
  /** The same matchups in the shape the engine reads. */
  matchups: CompletedMatchup[];
  roundNumberById: Map<string, number>;
}

/**
 * Load the season in the shape the pairing engine and standings expect.
 *
 * Three queries rather than nested joins, so nothing depends on relationship
 * metadata in the hand-written types.
 */
export async function getSeasonHistory(seasonId: string): Promise<SeasonHistory> {
  const supabase = createPublicClient();
  const rounds = await getSeasonRounds(seasonId);
  const roundNumberById = new Map(rounds.map((r) => [r.id, r.round_number]));

  if (rounds.length === 0) {
    return { rounds, matchupViews: [], matchups: [], roundNumberById };
  }

  const { data: pairings } = await supabase
    .from("pairings")
    .select("*")
    .in(
      "round_id",
      rounds.map((r) => r.id),
    );

  const allPairings = pairings ?? [];
  const gamesByPairing = await getGamesFor(allPairings.map((p) => p.id));

  const matchupViews = allPairings
    .map((pairing) => ({ pairing, games: gamesByPairing.get(pairing.id) ?? [] }))
    .sort(
      (a, b) =>
        (roundNumberById.get(a.pairing.round_id) ?? 0) -
          (roundNumberById.get(b.pairing.round_id) ?? 0) ||
        a.pairing.board_number - b.pairing.board_number,
    );

  return {
    rounds,
    matchupViews,
    matchups: matchupViews.map((view) =>
      toCompletedMatchup(view, roundNumberById.get(view.pairing.round_id) ?? 0),
    ),
    roundNumberById,
  };
}

async function getGamesFor(pairingIds: readonly string[]) {
  const byPairing = new Map<string, GameRow[]>();
  if (pairingIds.length === 0) return byPairing;

  const supabase = createPublicClient();
  const { data } = await supabase
    .from("games")
    .select("*")
    .in("pairing_id", pairingIds)
    .order("game_number", { ascending: true });

  for (const game of data ?? []) {
    const list = byPairing.get(game.pairing_id);
    if (list) list.push(game);
    else byPairing.set(game.pairing_id, [game]);
  }
  return byPairing;
}

/**
 * Convert to the engine's shape, dropping games that have no result yet.
 *
 * The matchup itself is always included even when nothing has been played, so
 * the two players still count as having met and will not be paired again.
 */
export function toCompletedMatchup(
  view: MatchupView,
  roundNumber: number,
): CompletedMatchup {
  return {
    roundNumber,
    playerAId: view.pairing.player_a_id,
    playerBId: view.pairing.player_b_id,
    games: view.games
      .filter((game) => game.result !== "pending")
      .map(
        (game): MatchupGame => ({
          gameNumber: game.game_number,
          colorA: game.color_a,
          result: game.result as MatchupGame["result"],
        }),
      ),
  };
}

export async function getRoundMatchups(roundId: string): Promise<MatchupView[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("pairings")
    .select("*")
    .eq("round_id", roundId)
    .order("board_number", { ascending: true });

  const pairings = data ?? [];
  const gamesByPairing = await getGamesFor(pairings.map((p) => p.id));
  return pairings.map((pairing) => ({
    pairing,
    games: gamesByPairing.get(pairing.id) ?? [],
  }));
}

export async function getMatchup(pairingId: string): Promise<MatchupView | null> {
  const supabase = createPublicClient();
  const { data: pairing } = await supabase
    .from("pairings")
    .select("*")
    .eq("id", pairingId)
    .maybeSingle();
  if (!pairing) return null;

  const { data: games } = await supabase
    .from("games")
    .select("*")
    .eq("pairing_id", pairingId)
    .order("game_number", { ascending: true });

  return { pairing, games: games ?? [] };
}

/**
 * The players a season's standings should list: everyone who has been paired at
 * least once, so the table reflects who actually turned up rather than the
 * whole club roll.
 */
export function seasonParticipants(
  roster: readonly PlayerRow[],
  matchups: readonly MatchupView[],
): PlayerRow[] {
  const seen = new Set<string>();
  for (const { pairing } of matchups) {
    seen.add(pairing.player_a_id);
    if (pairing.player_b_id) seen.add(pairing.player_b_id);
  }
  return roster.filter((player) => seen.has(player.id));
}

/** Players in the shape the engine wants, with a stable fallback seed. */
export function toPlayerInputs(players: readonly PlayerRow[]): PlayerProfileInput[] {
  return players.map((player) => ({
    id: player.id,
    pairingNumber: player.pairing_number ?? 0,
  }));
}

/** The aggregate score of a matchup, as "2 – 1". */
export function matchupScore(view: MatchupView): { a: number; b: number } {
  let a = 0;
  let b = 0;
  for (const game of view.games) {
    switch (game.result) {
      case "a_win":
      case "a_forfeit_win":
        a += 1;
        break;
      case "b_win":
      case "b_forfeit_win":
        b += 1;
        break;
      case "draw":
        a += 0.5;
        b += 0.5;
        break;
      // pending and double_forfeit award nothing to either player.
    }
  }
  return { a, b };
}
