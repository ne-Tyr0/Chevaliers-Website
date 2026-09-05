import { cache } from "react";
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

/**
 * The active season and its rounds, in a single round trip.
 *
 * Every page needs both, and each Supabase call costs roughly a quarter of a
 * second from here, so fetching them separately doubled the wait for nothing.
 * Cached per request, so asking for either costs one call in total.
 */
const getSeasonBundle = cache(
  async (): Promise<{ season: SeasonRow | null; rounds: RoundRow[] }> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("seasons")
      .select("*, rounds(*)")
      .eq("status", "active")
      .maybeSingle();

    if (!data) return { season: null, rounds: [] };
    const { rounds, ...season } = data;
    return {
      season,
      rounds: [...rounds].sort((a, b) => a.round_number - b.round_number),
    };
  },
);

export const getActiveSeason = cache(async (): Promise<SeasonRow | null> => {
  return (await getSeasonBundle()).season;
});

export const getSeasonRounds = cache(
  async (seasonId: string): Promise<RoundRow[]> => {
    const bundle = await getSeasonBundle();
    if (bundle.season?.id === seasonId) return bundle.rounds;

    // A season other than the active one: rare, so it pays its own round trip.
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("rounds")
      .select("*")
      .eq("season_id", seasonId)
      .order("round_number", { ascending: true });
    return data ?? [];
  },
);

/** The club roster, active members first, alphabetically within each group. */
export const getRoster = cache(async (): Promise<PlayerRow[]> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("players")
    .select("*")
    .order("is_active", { ascending: false })
    .order("full_name", { ascending: true });
  return data ?? [];
});

export interface SeasonHistory {
  rounds: RoundRow[];
  /** Every matchup of the season, with its games attached. */
  matchupViews: MatchupView[];
  /** The same matchups in the shape the engine reads. */
  matchups: CompletedMatchup[];
  roundNumberById: Map<string, number>;
}

/** Matchups and their games in one round trip, rather than one then the other. */
const PAIRING_WITH_GAMES = "*, games(*)";

function toViews(
  rows: readonly (PairingRow & { games: GameRow[] })[],
): MatchupView[] {
  return rows.map(({ games, ...pairing }) => ({
    pairing,
    games: [...games].sort((a, b) => a.game_number - b.game_number),
  }));
}

/**
 * Load the season in the shape the pairing engine and standings expect.
 *
 * Two round trips, not three: the games come back nested inside their
 * matchups. Each hop is a network call to Supabase, and on these pages that
 * latency is the whole cost.
 */
export const getSeasonHistory = cache(
  async (seasonId: string): Promise<SeasonHistory> => {
    const supabase = createPublicClient();
    const rounds = await getSeasonRounds(seasonId);
    const roundNumberById = new Map(rounds.map((r) => [r.id, r.round_number]));

    if (rounds.length === 0) {
      return { rounds, matchupViews: [], matchups: [], roundNumberById };
    }

    const { data } = await supabase
      .from("pairings")
      .select(PAIRING_WITH_GAMES)
      .in(
        "round_id",
        rounds.map((r) => r.id),
      );

    const matchupViews = toViews(data ?? []).sort(
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
  },
);

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

export const getRoundMatchups = cache(
  async (roundId: string): Promise<MatchupView[]> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("pairings")
      .select(PAIRING_WITH_GAMES)
      .eq("round_id", roundId)
      .order("board_number", { ascending: true });
    return toViews(data ?? []);
  },
);

export const getMatchup = cache(
  async (pairingId: string): Promise<MatchupView | null> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("pairings")
      .select(PAIRING_WITH_GAMES)
      .eq("id", pairingId)
      .maybeSingle();
    return data ? (toViews([data])[0] ?? null) : null;
  },
);

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
