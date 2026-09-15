"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  assertCanEnterResults,
  assertOfficer,
  canReviewPastRounds,
  endReview,
  grantReview,
  signIn,
  signOut,
} from "@/lib/officer/session";
import { createAdminClient } from "@/lib/supabase/server";
import type {
  DbPairingResult,
  DbPieceColor,
  SuggestionStatus,
} from "@/lib/supabase/database.types";
import {
  buildPlayerStates,
  GAMES_PER_MATCHUP,
  PairingError,
  pairRound,
} from "@/lib/swiss";
import { getActiveSeason, getRoundForGame, getSeasonHistory } from "./queries";
import {
  SUGGESTION_MAX_LENGTH,
  SUGGESTION_NAME_MAX_LENGTH,
  SUGGESTION_STATUSES,
} from "./suggestions";

/** Upper bound for the placeholder pairing number. Wide enough that ties are rare. */
const PAIRING_NUMBER_RANGE = 1_000_000;

const RESULTS = [
  "pending",
  "a_win",
  "b_win",
  "draw",
  "a_forfeit_win",
  "b_forfeit_win",
  "double_forfeit",
] as const;

function backToOfficer(error?: string): never {
  redirect(error ? `/officer?error=${encodeURIComponent(error)}` : "/officer");
}

/** Only ever return to a path inside this site. */
function safePath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value : "";
  return path.startsWith("/") && !path.startsWith("//") ? path : fallback;
}

function backTo(path: string, error?: string): never {
  redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

export async function unlockRole(formData: FormData) {
  const role = await signIn(String(formData.get("passcode") ?? ""));
  if (!role) redirect("/officer?error=That+passcode+is+not+right.");

  // Every page renders differently once a passcode is held, and the signed-out
  // versions are already in the router cache. Without this the redirect lands
  // back on the passcode gate that was just cleared, which reads exactly like
  // the passcode having been rejected.
  revalidatePath("/", "layout");
  redirect(role === "officer" ? "/officer" : "/arbiter");
}

export async function lockRole() {
  await signOut();
  revalidatePath("/", "layout");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Roster and seasons — officers only
// ---------------------------------------------------------------------------

export async function addPlayer(formData: FormData) {
  await assertOfficer();
  const fullName = String(formData.get("fullName") ?? "").trim();
  if (!fullName) backToOfficer("A player needs a name.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("players").insert({ full_name: fullName });
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  revalidatePath("/standings");
  backToOfficer();
}

/**
 * Retire or reinstate a player.
 *
 * Never a delete: their games are part of other players' tiebreaks, so removing
 * the row would silently change everyone else's standings.
 */
export async function setPlayerActive(formData: FormData) {
  await assertOfficer();
  const playerId = String(formData.get("playerId") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  if (!playerId) backToOfficer("Missing player.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("players")
    .update({ is_active: active })
    .eq("id", playerId);
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  backToOfficer();
}

export async function createSeason(formData: FormData) {
  await assertOfficer();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) backToOfficer("A season needs a name.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("seasons").insert({ name, status: "active" });
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  revalidatePath("/standings");
  backToOfficer();
}

// ---------------------------------------------------------------------------
// Rounds — officers only
// ---------------------------------------------------------------------------

/**
 * Open the next round of the active season.
 *
 * Refuses while an earlier round still has unplayed games — pairing the next
 * round from an incomplete one would use the wrong scores.
 */
export async function startRound(formData?: FormData) {
  await assertOfficer();
  const season = await getActiveSeason();
  if (!season) backToOfficer("There is no active season yet.");

  const { rounds, matchupViews } = await getSeasonHistory(season.id);

  const unfinished = rounds.find((round) => {
    const boards = matchupViews.filter((v) => v.pairing.round_id === round.id);
    return (
      boards.length > 0 &&
      boards.some((v) => v.games.some((g) => g.result === "pending"))
    );
  });
  if (unfinished) {
    backToOfficer(
      `Round ${unfinished.round_number} still has results outstanding. Enter them before starting a new round.`,
    );
  }

  const emptyRound = rounds.find(
    (round) => !matchupViews.some((v) => v.pairing.round_id === round.id),
  );
  if (emptyRound) {
    backToOfficer(
      `Round ${emptyRound.round_number} is already open and has no matchups yet.`,
    );
  }

  const nextNumber = rounds.reduce((max, r) => Math.max(max, r.round_number), 0) + 1;

  // Backfilled meetings happened before today, so the officer can date them.
  const playedOnRaw = String(formData?.get("playedOn") ?? "").trim();
  const playedOn = /^\d{4}-\d{2}-\d{2}$/.test(playedOnRaw) ? playedOnRaw : undefined;

  // Unticked for a round being entered from paper, where nobody wrote down who
  // had White. The checkbox is absent from the form entirely when unticked.
  const tracksColors = String(formData?.get("tracksColors") ?? "") === "on";

  const supabase = createAdminClient();
  const { error } = await supabase.from("rounds").insert({
    season_id: season.id,
    round_number: nextNumber,
    status: "pending",
    tracks_colors: tracksColors,
    ...(playedOn ? { played_on: playedOn } : {}),
  });
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  backToOfficer();
}

/** Create the empty games that make up a matchup. */
async function createGames(
  supabase: ReturnType<typeof createAdminClient>,
  pairingId: string,
) {
  return supabase.from("games").insert(
    Array.from({ length: GAMES_PER_MATCHUP }, (_, index) => ({
      pairing_id: pairingId,
      game_number: index + 1,
    })),
  );
}

/**
 * Pair every active player and write the matchups.
 *
 * There is no check-in step: the roster is the field. Each matchup is created
 * with its games empty, to be filled in as they are played.
 *
 * Anyone playing their first ever game gets a `pairing_number` here — assigned
 * once, then kept for the rest of their time at the club.
 */
export async function generatePairings(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) backToOfficer("Missing round.");

  const supabase = createAdminClient();
  const season = await getActiveSeason();
  if (!season) backToOfficer("There is no active season.");

  const { rounds, matchups, matchupViews } = await getSeasonHistory(season.id);
  const round = rounds.find((r) => r.id === roundId);
  if (!round) backToOfficer("That round is not part of the active season.");

  if (matchupViews.some((v) => v.pairing.round_id === roundId)) {
    backToOfficer(
      `Round ${round.round_number} already has matchups. Clear them before regenerating.`,
    );
  }

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .eq("is_active", true);

  if (!players || players.length < 2) {
    backToOfficer(
      "Add at least two active players to the roster before pairing a round.",
    );
  }

  const needsNumber = players.filter((p) => p.pairing_number === null);
  for (const player of needsNumber) {
    const pairingNumber = 1 + Math.floor(Math.random() * PAIRING_NUMBER_RANGE);
    const { error } = await supabase
      .from("players")
      .update({ pairing_number: pairingNumber })
      .eq("id", player.id);
    if (error) backToOfficer(`Could not assign a pairing number: ${error.message}`);
    player.pairing_number = pairingNumber;
  }

  const states = buildPlayerStates(
    players.map((p) => ({ id: p.id, pairingNumber: p.pairing_number ?? 0 })),
    matchups.filter((m) => m.roundNumber < round.round_number),
  );

  let outcome;
  try {
    outcome = pairRound(states, { roundNumber: round.round_number });
  } catch (cause) {
    backToOfficer(
      cause instanceof PairingError
        ? cause.message
        : "Could not pair this round. Please report this.",
    );
  }

  const { data: inserted, error: insertError } = await supabase
    .from("pairings")
    .insert(
      outcome.pairings.map((pairing) => ({
        round_id: roundId,
        board_number: pairing.boardNumber,
        player_a_id: pairing.playerAId,
        player_b_id: pairing.playerBId,
        is_rematch: pairing.isRematch,
      })),
    )
    .select();
  if (insertError) backToOfficer(insertError.message);

  for (const pairing of inserted ?? []) {
    // A bye has no games; its points are awarded by the standings calculation.
    if (pairing.player_b_id === null) continue;
    const { error } = await createGames(supabase, pairing.id);
    if (error) backToOfficer(error.message);
  }

  await supabase.from("rounds").update({ status: "in_progress" }).eq("id", roundId);

  revalidatePath("/officer");
  revalidatePath("/arbiter");
  revalidatePath("/standings");
  revalidatePath("/results");
  revalidatePath("/");
  backToOfficer();
}

/**
 * Add one matchup by hand.
 *
 * This is how a club catches up: meetings played before the site existed can be
 * entered round by round, so the engine has the history it needs.
 */
export async function addManualMatchup(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  const playerAId = String(formData.get("playerAId") ?? "");
  const playerBId = String(formData.get("playerBId") ?? "");
  if (!roundId || !playerAId) backToOfficer("Pick who played.");

  const isBye = playerBId === "" || playerBId === "bye";
  if (!isBye && playerAId === playerBId) {
    backToOfficer("A player cannot play themselves.");
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("pairings")
    .select("board_number, player_a_id, player_b_id")
    .eq("round_id", roundId);

  const boards = existing ?? [];
  const seated = new Set<string>();
  for (const board of boards) {
    seated.add(board.player_a_id);
    if (board.player_b_id) seated.add(board.player_b_id);
  }
  if (seated.has(playerAId) || (!isBye && seated.has(playerBId))) {
    backToOfficer("Someone in that matchup already has a game this round.");
  }

  const { data: pairing, error } = await supabase
    .from("pairings")
    .insert({
      round_id: roundId,
      board_number: boards.reduce((max, b) => Math.max(max, b.board_number), 0) + 1,
      player_a_id: playerAId,
      player_b_id: isBye ? null : playerBId,
    })
    .select()
    .single();
  if (error || !pairing) {
    backToOfficer(error?.message ?? "Could not add the matchup.");
  }

  if (!isBye) {
    const { error: gamesError } = await createGames(supabase, pairing.id);
    if (gamesError) backToOfficer(gamesError.message);
  }

  await supabase.from("rounds").update({ status: "in_progress" }).eq("id", roundId);

  revalidatePath("/officer");
  revalidatePath("/arbiter");
  revalidatePath("/standings");
  revalidatePath("/results");
  backToOfficer();
}

export async function deleteMatchup(formData: FormData) {
  await assertOfficer();
  const pairingId = String(formData.get("pairingId") ?? "");
  if (!pairingId) backToOfficer("Missing matchup.");

  // Games cascade with the matchup.
  const supabase = createAdminClient();
  const { error } = await supabase.from("pairings").delete().eq("id", pairingId);
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  revalidatePath("/standings");
  revalidatePath("/results");
  backToOfficer();
}

export async function clearPairings(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) backToOfficer("Missing round.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("pairings").delete().eq("round_id", roundId);
  if (error) backToOfficer(error.message);

  await supabase.from("rounds").update({ status: "pending" }).eq("id", roundId);

  revalidatePath("/officer");
  revalidatePath("/arbiter");
  revalidatePath("/standings");
  revalidatePath("/results");
  backToOfficer();
}

// ---------------------------------------------------------------------------
// Game results — officers and arbiters
// ---------------------------------------------------------------------------

/**
 * Refuse to touch a game in a closed round without the review window open.
 *
 * Scores and both tiebreaks are derived from games, so editing a finished round
 * reshuffles the whole season. Requiring the passcode again makes that a
 * deliberate act rather than something an unattended laptop allows. Arbiters
 * never qualify, because the review window is officers-only.
 *
 * Returns the round, so callers can use its settings.
 */
async function assertGameEditable(gameId: string, returnTo: string) {
  const round = await getRoundForGame(gameId);
  if (!round) backTo(returnTo, "That game no longer exists.");

  if (round.status === "completed" && !(await canReviewPastRounds())) {
    backTo(
      returnTo,
      `Round ${round.round_number} is closed. Re-enter the officer passcode to change it.`,
    );
  }
  return round;
}

export async function recordGame(formData: FormData) {
  const role = await assertCanEnterResults();
  const gameId = String(formData.get("gameId") ?? "");
  const result = String(formData.get("result") ?? "");
  const returnTo = safePath(formData.get("returnTo"), "/officer");

  if (!gameId || !RESULTS.includes(result as DbPairingResult)) {
    backTo(returnTo, "That is not a valid result.");
  }
  await assertGameEditable(gameId, returnTo);

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("games")
    .update({
      result: result as DbPairingResult,
      updated_by: role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);
  if (error) backTo(returnTo, error.message);

  revalidatePath(returnTo);
  revalidatePath("/officer");
  revalidatePath("/arbiter");
  revalidatePath("/standings");
  revalidatePath("/results");
  revalidatePath("/");
  backTo(returnTo);
}

/** Record which pieces player A had in one game. */
export async function setGameColor(formData: FormData) {
  const role = await assertCanEnterResults();
  const gameId = String(formData.get("gameId") ?? "");
  const color = String(formData.get("colorA") ?? "");
  const returnTo = safePath(formData.get("returnTo"), "/officer");

  if (!gameId || (color !== "white" && color !== "black" && color !== "")) {
    backTo(returnTo, "That is not a valid colour.");
  }

  const round = await assertGameEditable(gameId, returnTo);
  if (!round.tracks_colors) {
    backTo(
      returnTo,
      `Round ${round.round_number} does not record colours. Turn that on for the round first.`,
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("games")
    .update({
      color_a: color === "" ? null : (color as DbPieceColor),
      updated_by: role,
      updated_at: new Date().toISOString(),
    })
    .eq("id", gameId);
  if (error) backTo(returnTo, error.message);

  revalidatePath(returnTo);
  revalidatePath("/standings");
  revalidatePath("/results");
  backTo(returnTo);
}

/**
 * Turn colour recording on or off for a round that is still open.
 *
 * Switching it off leaves any colours already entered in place rather than
 * wiping them; they simply stop being asked for. Nothing reads a colour that a
 * round no longer tracks, so stale values are inert, and deleting them would
 * throw away correct information over a change of mind.
 */
export async function setRoundColorTracking(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  const tracks = String(formData.get("tracks") ?? "") === "true";
  const returnTo = safePath(formData.get("returnTo"), "/officer");
  if (!roundId) backTo(returnTo, "Missing round.");

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("rounds")
    .update({ tracks_colors: tracks })
    .eq("id", roundId)
    .neq("status", "completed");
  if (error) backTo(returnTo, error.message);

  revalidatePath(returnTo);
  revalidatePath("/officer");
  revalidatePath("/results");
  backTo(returnTo);
}

/** Re-check the officer passcode and open the window for editing closed rounds. */
export async function openReview(formData: FormData) {
  await assertOfficer();
  const returnTo = safePath(formData.get("returnTo"), "/officer");
  const granted = await grantReview(String(formData.get("passcode") ?? ""));
  backTo(returnTo, granted ? undefined : "That passcode is not right.");
}

export async function closeReview(formData: FormData) {
  const returnTo = safePath(formData.get("returnTo"), "/officer");
  await endReview();
  revalidatePath(returnTo);
  backTo(returnTo);
}

export async function completeRound(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) backToOfficer("Missing round.");

  const supabase = createAdminClient();
  const { data: pairings } = await supabase
    .from("pairings")
    .select("id")
    .eq("round_id", roundId);

  if (!pairings || pairings.length === 0) {
    backToOfficer("This round has no matchups yet.");
  }

  const pairingIds = pairings.map((p) => p.id);
  const { data: games } = await supabase
    .from("games")
    .select("id, result")
    .in("pairing_id", pairingIds);

  const unplayed = (games ?? []).filter((g) => g.result === "pending");
  if (unplayed.length > 0) {
    if (String(formData.get("forfeitUnplayed") ?? "") !== "true") {
      backToOfficer(
        `${unplayed.length} ${unplayed.length === 1 ? "game has" : "games have"} no result yet. Enter them, or close the round forfeiting them.`,
      );
    }

    // A game nobody completed is a double forfeit: neither player scores.
    const { error } = await supabase
      .from("games")
      .update({ result: "double_forfeit", updated_by: "officer" })
      .in("pairing_id", pairingIds)
      .eq("result", "pending");
    if (error) backToOfficer(error.message);
  }

  const { error } = await supabase
    .from("rounds")
    .update({ status: "completed" })
    .eq("id", roundId);
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  revalidatePath("/arbiter");
  revalidatePath("/standings");
  revalidatePath("/results");
  revalidatePath("/");
  backToOfficer();
}

// ---------------------------------------------------------------------------
// Suggestions — anyone sends, officers triage
// ---------------------------------------------------------------------------

/** Remembers when this browser last sent a suggestion. */
const SUGGESTED_COOKIE = "chevaliers_suggested";
/** How long one browser waits between suggestions. */
const SUGGESTION_COOLDOWN_MS = 60 * 1000;
/**
 * Most suggestions the whole site accepts in an hour. Clearing cookies gets
 * round the per-browser wait, so this is the backstop against a flood.
 */
const SUGGESTIONS_PER_HOUR = 30;

function backToSuggest(error: string): never {
  redirect(`/suggest?error=${encodeURIComponent(error)}`);
}

function backToSuggestionsTab(error?: string): never {
  redirect(
    error
      ? `/officer?tab=suggestions&error=${encodeURIComponent(error)}`
      : "/officer?tab=suggestions",
  );
}

/**
 * The public suggestion form.
 *
 * The only action that runs without a passcode, so it trusts nothing: it trims
 * and bounds both fields, and inserts a single row. Protection is deliberately
 * light — no CAPTCHA for students to fight — and comes in three layers:
 *
 *   1. A honeypot field hidden from people. Bots that fill every input are told
 *      it worked, and nothing is saved.
 *   2. A one-minute wait per browser, held in a cookie.
 *   3. A site-wide cap per hour, for anyone who clears the cookie.
 */
export async function submitSuggestion(formData: FormData) {
  if (String(formData.get("website") ?? "") !== "") redirect("/suggest?sent=1");

  const body = String(formData.get("body") ?? "").trim();
  const nameInput = String(formData.get("name") ?? "").trim();
  const name = nameInput === "" ? null : nameInput;

  if (!body) backToSuggest("Write your suggestion before sending it.");
  if (body.length > SUGGESTION_MAX_LENGTH) {
    backToSuggest(
      `Keep it under ${SUGGESTION_MAX_LENGTH} characters — that one is ${body.length}.`,
    );
  }
  if (name && name.length > SUGGESTION_NAME_MAX_LENGTH) {
    backToSuggest(`Names are limited to ${SUGGESTION_NAME_MAX_LENGTH} characters.`);
  }

  const cookieStore = await cookies();
  const lastSent = Number(cookieStore.get(SUGGESTED_COOKIE)?.value);
  if (Number.isFinite(lastSent) && Date.now() - lastSent < SUGGESTION_COOLDOWN_MS) {
    backToSuggest("You just sent one. Give it a minute before sending another.");
  }

  const supabase = createAdminClient();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("suggestions")
    .select("id", { count: "exact", head: true })
    .gte("created_at", hourAgo);
  if ((count ?? 0) >= SUGGESTIONS_PER_HOUR) {
    backToSuggest(
      "The suggestion box is full for the moment. Please try again in an hour.",
    );
  }

  const { error } = await supabase.from("suggestions").insert({ body, name });
  if (error) backToSuggest("That did not send. Please try again.");

  cookieStore.set(SUGGESTED_COOKIE, String(Date.now()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.ceil(SUGGESTION_COOLDOWN_MS / 1000),
  });

  revalidatePath("/officer");
  redirect("/suggest?sent=1");
}

export async function setSuggestionStatus(formData: FormData) {
  await assertOfficer();
  const suggestionId = String(formData.get("suggestionId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!suggestionId || !SUGGESTION_STATUSES.includes(status as SuggestionStatus)) {
    backToSuggestionsTab("That status is not recognised.");
  }

  const { error } = await createAdminClient()
    .from("suggestions")
    .update({ status: status as SuggestionStatus })
    .eq("id", suggestionId);
  if (error) backToSuggestionsTab(error.message);

  revalidatePath("/officer");
  backToSuggestionsTab();
}

export async function deleteSuggestion(formData: FormData) {
  await assertOfficer();
  const suggestionId = String(formData.get("suggestionId") ?? "");
  if (!suggestionId) backToSuggestionsTab("That suggestion no longer exists.");

  const { error } = await createAdminClient()
    .from("suggestions")
    .delete()
    .eq("id", suggestionId);
  if (error) backToSuggestionsTab(error.message);

  revalidatePath("/officer");
  backToSuggestionsTab();
}
