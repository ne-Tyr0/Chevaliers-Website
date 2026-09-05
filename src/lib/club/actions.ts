"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertOfficer, signInOfficer, signOutOfficer } from "@/lib/officer/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  buildPlayerStates,
  PairingError,
  pairRound,
  type CompletedPairing,
} from "@/lib/swiss";
import { getActiveSeason, getSeasonHistory } from "./queries";

/** Upper bound for the placeholder pairing number. Wide enough that ties are rare. */
const PAIRING_NUMBER_RANGE = 1_000_000;

function backToOfficer(error?: string): never {
  redirect(error ? `/officer?error=${encodeURIComponent(error)}` : "/officer");
}

export async function unlockOfficer(formData: FormData) {
  const passcode = String(formData.get("passcode") ?? "");
  const ok = await signInOfficer(passcode);
  redirect(ok ? "/officer" : "/officer?error=That+passcode+is+not+right.");
}

export async function lockOfficer() {
  await signOutOfficer();
  redirect("/");
}

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

/**
 * Open the next round of the active season.
 *
 * Refuses while an earlier round still has unplayed boards — pairing the next
 * round from an incomplete one would use the wrong scores.
 */
export async function startRound(formData?: FormData) {
  await assertOfficer();
  const season = await getActiveSeason();
  if (!season) backToOfficer("There is no active season yet.");

  const { rounds, allPairings } = await getSeasonHistory(season.id);

  const unfinished = rounds.find((round) => {
    const boards = allPairings.filter((p) => p.round_id === round.id);
    return boards.length > 0 && boards.some((p) => p.result === "pending");
  });
  if (unfinished) {
    backToOfficer(
      `Round ${unfinished.round_number} still has results outstanding. Enter them before starting a new round.`,
    );
  }

  const emptyRound = rounds.find(
    (round) => !allPairings.some((p) => p.round_id === round.id),
  );
  if (emptyRound) {
    backToOfficer(
      `Round ${emptyRound.round_number} is already open and has no pairings yet.`,
    );
  }

  const nextNumber = rounds.reduce((max, r) => Math.max(max, r.round_number), 0) + 1;

  // Backfilled meetings happened before today, so the officer can date them.
  const playedOnRaw = String(formData?.get("playedOn") ?? "").trim();
  const playedOn = /^\d{4}-\d{2}-\d{2}$/.test(playedOnRaw) ? playedOnRaw : undefined;

  const supabase = createAdminClient();
  const { error } = await supabase.from("rounds").insert({
    season_id: season.id,
    round_number: nextNumber,
    status: "pending",
    ...(playedOn ? { played_on: playedOn } : {}),
  });
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  backToOfficer();
}

export async function setCheckIn(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const present = String(formData.get("present") ?? "") === "true";
  if (!roundId || !playerId) backToOfficer("Missing round or player.");

  const supabase = createAdminClient();
  const { error } = present
    ? await supabase
        .from("round_check_ins")
        .upsert({ round_id: roundId, player_id: playerId })
    : await supabase
        .from("round_check_ins")
        .delete()
        .eq("round_id", roundId)
        .eq("player_id", playerId);

  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  backToOfficer();
}

/**
 * Pair the checked-in players for a round and write the boards.
 *
 * Anyone playing their first ever game gets a `pairing_number` here — it is
 * assigned once and then kept for the rest of their time at the club.
 */
export async function generatePairings(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) backToOfficer("Missing round.");

  const supabase = createAdminClient();
  const season = await getActiveSeason();
  if (!season) backToOfficer("There is no active season.");

  const { rounds, completed, allPairings } = await getSeasonHistory(season.id);
  const round = rounds.find((r) => r.id === roundId);
  if (!round) backToOfficer("That round is not part of the active season.");

  if (allPairings.some((p) => p.round_id === roundId)) {
    backToOfficer(
      `Round ${round.round_number} already has pairings. Clear them before regenerating.`,
    );
  }

  const { data: checkIns } = await supabase
    .from("round_check_ins")
    .select("player_id")
    .eq("round_id", roundId);

  const checkedInIds = (checkIns ?? []).map((row) => row.player_id);
  if (checkedInIds.length === 0) {
    backToOfficer("Nobody is checked in for this round yet.");
  }

  const { data: players } = await supabase
    .from("players")
    .select("*")
    .in("id", checkedInIds);

  if (!players || players.length !== checkedInIds.length) {
    backToOfficer("Could not load every checked-in player.");
  }

  // First game ever: give them their persistent pairing number.
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

  const priorRounds: CompletedPairing[] = completed.filter(
    (p) => p.roundNumber < round.round_number,
  );

  const states = buildPlayerStates(
    players.map((p) => ({ id: p.id, pairingNumber: p.pairing_number ?? 0 })),
    priorRounds,
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

  const { error: insertError } = await supabase.from("pairings").insert(
    outcome.pairings.map((pairing) => ({
      round_id: roundId,
      board_number: pairing.boardNumber,
      player_a_id: pairing.playerAId,
      player_b_id: pairing.playerBId,
      color_a: pairing.colorA,
      color_b: pairing.colorB,
      // A bye is a completed point the moment it is assigned; there is no game
      // to play, so it must not sit in the round as an outstanding result.
      result: pairing.playerBId === null ? ("a_win" as const) : ("pending" as const),
      is_rematch: pairing.isRematch,
    })),
  );
  if (insertError) backToOfficer(insertError.message);

  await supabase.from("rounds").update({ status: "in_progress" }).eq("id", roundId);

  revalidatePath("/officer");
  revalidatePath("/standings");
  revalidatePath("/");
  backToOfficer();
}

/**
 * Record one board by hand.
 *
 * This is how a club catches up: meetings played before the site existed can be
 * entered round by round, so the engine has the match history it needs to avoid
 * rematches and to score the season correctly from here on.
 */
export async function addManualPairing(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  const whiteId = String(formData.get("whiteId") ?? "");
  const blackId = String(formData.get("blackId") ?? "");
  const result = String(formData.get("result") ?? "");
  if (!roundId || !whiteId) backToOfficer("Pick who played.");

  const isBye = blackId === "" || blackId === "bye";
  if (!isBye && whiteId === blackId) {
    backToOfficer("A player cannot play themselves.");
  }

  const outcomes = ["a_win", "b_win", "draw"] as const;
  if (!isBye && !outcomes.includes(result as (typeof outcomes)[number])) {
    backToOfficer("Pick a result for the board.");
  }

  const supabase = createAdminClient();
  const { data: existing } = await supabase
    .from("pairings")
    .select("board_number, player_a_id, player_b_id")
    .eq("round_id", roundId);

  const boards = existing ?? [];

  // The unique indexes stop a player appearing twice in the same column, but
  // not once as White and again as Black, so check across both here.
  const alreadySeated = new Set<string>();
  for (const board of boards) {
    alreadySeated.add(board.player_a_id);
    if (board.player_b_id) alreadySeated.add(board.player_b_id);
  }
  if (alreadySeated.has(whiteId) || (!isBye && alreadySeated.has(blackId))) {
    backToOfficer("Someone in that board already has a game this round.");
  }

  const nextBoard =
    boards.reduce((max, b) => Math.max(max, b.board_number), 0) + 1;

  const { error } = await supabase.from("pairings").insert({
    round_id: roundId,
    board_number: nextBoard,
    player_a_id: whiteId,
    player_b_id: isBye ? null : blackId,
    color_a: isBye ? null : ("white" as const),
    color_b: isBye ? null : ("black" as const),
    // A bye is already decided; it is never an outstanding result.
    result: isBye ? ("a_win" as const) : (result as (typeof outcomes)[number]),
  });
  if (error) backToOfficer(error.message);

  await supabase
    .from("rounds")
    .update({ status: "in_progress" })
    .eq("id", roundId);

  revalidatePath("/officer");
  revalidatePath("/standings");
  revalidatePath("/");
  backToOfficer();
}

export async function deletePairing(formData: FormData) {
  await assertOfficer();
  const pairingId = String(formData.get("pairingId") ?? "");
  if (!pairingId) backToOfficer("Missing board.");

  const supabase = createAdminClient();
  const { error } = await supabase.from("pairings").delete().eq("id", pairingId);
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  revalidatePath("/standings");
  revalidatePath("/");
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
  revalidatePath("/standings");
  backToOfficer();
}

export async function recordResult(formData: FormData) {
  await assertOfficer();
  const pairingId = String(formData.get("pairingId") ?? "");
  const result = String(formData.get("result") ?? "");

  const allowed = ["pending", "a_win", "b_win", "draw"] as const;
  if (!pairingId || !allowed.includes(result as (typeof allowed)[number])) {
    backToOfficer("That is not a valid result.");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("pairings")
    .update({ result: result as (typeof allowed)[number] })
    .eq("id", pairingId);
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  revalidatePath("/standings");
  revalidatePath("/");
  backToOfficer();
}

export async function completeRound(formData: FormData) {
  await assertOfficer();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) backToOfficer("Missing round.");

  const supabase = createAdminClient();
  const { data: boards } = await supabase
    .from("pairings")
    .select("result")
    .eq("round_id", roundId);

  if (!boards || boards.length === 0) {
    backToOfficer("This round has no pairings yet.");
  }
  if (boards.some((b) => b.result === "pending")) {
    backToOfficer("Every board needs a result before the round can be closed.");
  }

  const { error } = await supabase
    .from("rounds")
    .update({ status: "completed" })
    .eq("id", roundId);
  if (error) backToOfficer(error.message);

  revalidatePath("/officer");
  revalidatePath("/standings");
  revalidatePath("/");
  backToOfficer();
}
