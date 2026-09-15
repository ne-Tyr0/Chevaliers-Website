import { cache } from "react";
import type { PlayerRow, SeasonRow } from "@/lib/supabase/database.types";
import {
  computeStandings,
  playerHistory,
  type GameRecord,
  type StandingRow,
} from "@/lib/swiss";
import {
  getActiveSeason,
  getRoster,
  getSeasonHistory,
  seasonParticipants,
  toPlayerInputs,
  type SeasonHistory,
} from "./queries";

/** Everything the public pages show about the running season, worked out once. */
export interface SeasonSnapshot {
  season: SeasonRow;
  roster: PlayerRow[];
  history: SeasonHistory;
  standings: StandingRow[];
  rowById: Map<string, StandingRow>;
  playerById: Map<string, PlayerRow>;
  nameById: Map<string, string>;
  gamesByPlayer: Map<string, GameRecord[]>;
  /** Rounds with at least one result in, which is what "played" means to a reader. */
  roundsPlayed: number;
}

/**
 * The active season with standings computed, or null if none is running.
 *
 * The home, standings, results and player pages all need the same figures.
 * Cached per request, so a page that renders several of them pays once.
 */
export const getSeasonSnapshot = cache(async (): Promise<SeasonSnapshot | null> => {
  const season = await getActiveSeason();
  if (!season) return null;

  const [roster, history] = await Promise.all([
    getRoster(),
    getSeasonHistory(season.id),
  ]);

  const standings = computeStandings(
    toPlayerInputs(seasonParticipants(roster, history.matchupViews)),
    history.matchups,
  );
  const byPlayer = playerHistory(history.matchups);

  return {
    season,
    roster,
    history,
    standings,
    rowById: new Map(standings.map((row) => [row.playerId, row])),
    playerById: new Map(roster.map((p) => [p.id, p])),
    nameById: new Map(roster.map((p) => [p.id, p.full_name])),
    gamesByPlayer: new Map([...byPlayer].map(([id, entry]) => [id, entry.games])),
    roundsPlayed: history.rounds.filter((round) =>
      history.matchupViews.some(
        (view) =>
          view.pairing.round_id === round.id &&
          view.games.some((game) => game.result !== "pending"),
      ),
    ).length,
  };
});
