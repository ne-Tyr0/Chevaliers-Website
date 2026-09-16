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
 * The whole active season — its rounds, their matchups and every game — in one
 * request.
 *
 * This used to be two requests that had to run one after the other: the season
 * with its rounds, then the matchups for those rounds. The database is in
 * Singapore and the pages render on Vercel, so every request is a round trip
 * measured in hundreds of milliseconds and the second one could not start
 * until the first came back. Asking Postgres to nest the whole lot costs one
 * trip instead, and the rows are the same rows.
 *
 * Cached per request, so a page that wants the season, the rounds and the
 * matchups pays for one call between them.
 */
const getSeasonBundle = cache(
  async (): Promise<{
    season: SeasonRow | null;
    rounds: RoundRow[];
    matchupViews: MatchupView[];
  }> => {
    const supabase = createPublicClient();
    const { data } = await supabase
      .from("seasons")
      .select("*, rounds(*, pairings(*, games(*)))")
      .eq("status", "active")
      .maybeSingle();

    if (!data) return { season: null, rounds: [], matchupViews: [] };
    const { rounds, ...season } = data;

    // The rounds without their nested matchups, which travel separately.
    const sortedRounds: RoundRow[] = rounds
      .map((round) => ({
        id: round.id,
        season_id: round.season_id,
        round_number: round.round_number,
        played_on: round.played_on,
        status: round.status,
        tracks_colors: round.tracks_colors,
        created_at: round.created_at,
      }))
      .sort((a, b) => a.round_number - b.round_number);
    const roundNumberById = new Map(sortedRounds.map((r) => [r.id, r.round_number]));

    const matchupViews = toViews(rounds.flatMap((round) => round.pairings)).sort(
      (a, b) =>
        (roundNumberById.get(a.pairing.round_id) ?? 0) -
          (roundNumberById.get(b.pairing.round_id) ?? 0) ||
        a.pairing.board_number - b.pairing.board_number,
    );

    return { season, rounds: sortedRounds, matchupViews };
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
    const bundle = await getSeasonBundle();
    const rounds = await getSeasonRounds(seasonId);
    const roundNumberById = new Map(rounds.map((r) => [r.id, r.round_number]));

    if (rounds.length === 0) {
      return { rounds, matchupViews: [], matchups: [], roundNumberById };
    }

    // The active season came back whole with the bundle; anything older pays
    // for its own request, which is rare enough not to matter.
    const matchupViews =
      bundle.season?.id === seasonId
        ? bundle.matchupViews
        : toViews(
            (
              await createPublicClient()
                .from("pairings")
                .select(PAIRING_WITH_GAMES)
                .in(
                  "round_id",
                  rounds.map((r) => r.id),
                )
            ).data ?? [],
          ).sort(
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

export const getRound = cache(async (roundId: string): Promise<RoundRow | null> => {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("rounds")
    .select("*")
    .eq("id", roundId)
    .maybeSingle();
  return data ?? null;
});

/**
 * The round a single game belongs to, for deciding whether editing it counts as
 * changing history. Two hops rather than a nested select, because this runs in
 * an action rather than on a page and correctness matters more than the
 * round trip.
 */
export async function getRoundForGame(gameId: string): Promise<RoundRow | null> {
  const supabase = createPublicClient();
  const { data: game } = await supabase
    .from("games")
    .select("pairing_id")
    .eq("id", gameId)
    .maybeSingle();
  if (!game) return null;

  const { data: pairing } = await supabase
    .from("pairings")
    .select("round_id")
    .eq("id", game.pairing_id)
    .maybeSingle();
  if (!pairing) return null;

  return getRound(pairing.round_id);
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
