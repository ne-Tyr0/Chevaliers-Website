import { createPublicClient } from "@/lib/supabase/server";
import type {
  PairingRow,
  PlayerRow,
  RoundRow,
  SeasonRow,
} from "@/lib/supabase/database.types";
import type { CompletedPairing, PlayerProfileInput } from "@/lib/swiss";

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

export async function getRoundPairings(roundId: string): Promise<PairingRow[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("pairings")
    .select("*")
    .eq("round_id", roundId)
    .order("board_number", { ascending: true });
  return data ?? [];
}

export async function getCheckedInIds(roundId: string): Promise<string[]> {
  const supabase = createPublicClient();
  const { data } = await supabase
    .from("round_check_ins")
    .select("player_id")
    .eq("round_id", roundId);
  return (data ?? []).map((row) => row.player_id);
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
  /** Finished games only — a pending board contributes nothing yet. */
  completed: CompletedPairing[];
  /** Every pairing of the season, including pending ones. */
  allPairings: PairingRow[];
  roundNumberById: Map<string, number>;
}

/**
 * Load the season's match history in the shape the pairing engine and the
 * standings calculation expect.
 *
 * Fetched as two queries rather than a nested join, so the result does not
 * depend on relationship metadata in the generated types.
 */
export async function getSeasonHistory(seasonId: string): Promise<SeasonHistory> {
  const supabase = createPublicClient();
  const rounds = await getSeasonRounds(seasonId);

  const roundNumberById = new Map(rounds.map((r) => [r.id, r.round_number]));
  if (rounds.length === 0) {
    return { rounds, completed: [], allPairings: [], roundNumberById };
  }

  const { data } = await supabase
    .from("pairings")
    .select("*")
    .in(
      "round_id",
      rounds.map((r) => r.id),
    );

  const allPairings = data ?? [];
  const completed: CompletedPairing[] = allPairings
    .filter((p) => p.result !== "pending")
    .map((p) => ({
      roundNumber: roundNumberById.get(p.round_id) ?? 0,
      playerAId: p.player_a_id,
      playerBId: p.player_b_id,
      colorA: p.color_a,
      colorB: p.color_b,
      result: p.result as "a_win" | "b_win" | "draw",
    }));

  return { rounds, completed, allPairings, roundNumberById };
}

/**
 * The players a season's standings should list: everyone who has been paired at
 * least once, so the table reflects who actually turned up rather than the
 * whole club roll.
 */
export function seasonParticipants(
  roster: readonly PlayerRow[],
  pairings: readonly PairingRow[],
): PlayerRow[] {
  const seen = new Set<string>();
  for (const p of pairings) {
    seen.add(p.player_a_id);
    if (p.player_b_id) seen.add(p.player_b_id);
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
