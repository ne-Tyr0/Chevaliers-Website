/**
 * One-off import of the Inaugural Games round 3 pairing sheet.
 *
 * Replaces the scaffolding data used while building the site with the real
 * club: 44 players, and round 3's 22 matchups with their games left empty for
 * officers to fill in.
 *
 * The site's records deliberately start at round 3. Rounds 1 and 2 exist on the
 * club's sheets only as totals, and the engine derives standings from actual
 * games, so entering totals would produce tiebreaks that cannot be reconciled
 * with anything. See the note on the standings page.
 *
 * Destructive. Run with --confirm.
 *
 *   node scripts/import-round3.mjs --confirm
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const SEASON_NAME = "Inaugural Games";
const ROUND_NUMBER = 3;
const PLAYED_ON = "2026-09-03";
const GAMES_PER_MATCHUP = 3;

/*
 * The PDF draws through a subsetted font whose codes sit 29 below the ASCII
 * they render, which the extraction already undid. Two glyphs fall outside
 * ASCII and land on these codes instead. Mapping them is what keeps Niño and
 * André spelled correctly rather than published with letters missing.
 */
const GLYPHS = { 149: "ñ", 141: "é" };

/** Undo the extraction artefacts on one line of the sheet. */
function clean(line) {
  return [...line]
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (GLYPHS[code]) return GLYPHS[code];
      // Two-byte glyph codes left a control byte before every character.
      return code < 32 ? "" : ch;
    })
    .join("")
    .trim();
}

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

/** Read the decoded pairing sheet into ordered players. */
function readSheet(path) {
  const furniture = new Set([
    "Philippine Science High School - Central Visayas Campus in Cebu",
    "Chevaliers Society", "Inaugural Games (Round 3)", "September 3, 2026",
    "Arbiter", "Pair No.", "Name", "Grade", "Standing (Round)", "Previous",
    "Score", "Rank", "Round 3", "New", "W", "L", "D",
  ]);

  const lines = readFileSync(path, "utf8")
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean)
    .filter((l) => !l.startsWith("=") && !furniture.has(l));

  const isName = (l) => /^[A-Za-z]/.test(l) && l.includes(",");
  const isGrade = (l) => /^\d{1,2}-[A-Za-z]/.test(l);
  const isNumber = (l) => /^\d+(\.\d+)?$/.test(l);

  const players = [];
  for (let i = 0; i < lines.length; i++) {
    if (!isName(lines[i])) continue;
    if (!isGrade(lines[i + 1]) || !isNumber(lines[i + 2])) continue;
    players.push({
      name: lines[i],
      grade: lines[i + 1],
      previousScore: Number(lines[i + 2]),
      previousRank: isNumber(lines[i + 3]) ? Number(lines[i + 3]) : null,
    });
  }
  return players;
}

async function main() {
  const sheet = process.argv[2] ?? "scripts/round3.txt";
  const players = readSheet(sheet);

  if (players.length === 0 || players.length % 2 !== 0) {
    throw new Error(`expected an even, non-zero number of players, got ${players.length}`);
  }

  console.log(`${players.length} players, ${players.length / 2} matchups`);

  if (!process.argv.includes("--confirm")) {
    console.log("\nDry run. Nothing written. Re-run with --confirm to apply.");
    for (let i = 0; i < players.length; i += 2) {
      console.log(
        `  ${String(i / 2 + 1).padStart(2)}  ${players[i].name} v ${players[i + 1].name}`,
      );
    }
    return;
  }

  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // The grade column arrives in migration 0006; fail clearly rather than
  // writing half the roster.
  const probe = await db.from("players").select("grade").limit(1);
  if (probe.error) {
    throw new Error(
      `players.grade is missing — run supabase/migrations/0006_player_grade.sql first (${probe.error.message})`,
    );
  }

  console.log("\nclearing scaffolding data...");
  const { data: seasons } = await db.from("seasons").select("id, name");
  for (const s of seasons ?? []) {
    // Rounds, pairings and games all cascade from the season.
    await db.from("seasons").delete().eq("id", s.id);
    console.log("  deleted season:", s.name);
  }
  const { data: oldPlayers } = await db.from("players").select("id, full_name");
  for (const p of oldPlayers ?? []) {
    const { error } = await db.from("players").delete().eq("id", p.id);
    console.log(error ? `  KEPT ${p.full_name}: ${error.message}` : `  deleted player: ${p.full_name}`);
  }

  console.log("\ninserting roster...");
  const inserted = [];
  for (const [index, player] of players.entries()) {
    // The sheet is ordered by standing, so seeding the pairing number from that
    // order makes the engine's tie-break within a score group reflect real
    // strength rather than a coin toss.
    const pairingNumber = (players.length - index) * 100;
    const { data, error } = await db
      .from("players")
      .insert({ full_name: player.name, grade: player.grade, pairing_number: pairingNumber })
      .select()
      .single();
    if (error) throw new Error(`${player.name}: ${error.message}`);
    inserted.push(data);
  }
  console.log(`  ${inserted.length} players`);

  console.log("\ncreating season and round...");
  const { data: season, error: seasonError } = await db
    .from("seasons")
    .insert({ name: SEASON_NAME, status: "active" })
    .select()
    .single();
  if (seasonError) throw new Error(seasonError.message);

  const { data: round, error: roundError } = await db
    .from("rounds")
    .insert({
      season_id: season.id,
      round_number: ROUND_NUMBER,
      played_on: PLAYED_ON,
      status: "in_progress",
    })
    .select()
    .single();
  if (roundError) throw new Error(roundError.message);
  console.log(`  ${season.name}, round ${round.round_number} (${round.played_on})`);

  console.log("\ninserting matchups...");
  for (let i = 0; i < inserted.length; i += 2) {
    const board = i / 2 + 1;
    const { data: pairing, error } = await db
      .from("pairings")
      .insert({
        round_id: round.id,
        board_number: board,
        player_a_id: inserted[i].id,
        player_b_id: inserted[i + 1].id,
      })
      .select()
      .single();
    if (error) throw new Error(`board ${board}: ${error.message}`);

    // Colours are left null on purpose: the sheet does not record them.
    const { error: gamesError } = await db.from("games").insert(
      Array.from({ length: GAMES_PER_MATCHUP }, (_, g) => ({
        pairing_id: pairing.id,
        game_number: g + 1,
      })),
    );
    if (gamesError) throw new Error(`board ${board} games: ${gamesError.message}`);
  }
  console.log(`  ${inserted.length / 2} matchups, ${(inserted.length / 2) * GAMES_PER_MATCHUP} games awaiting results`);
  console.log("\ndone.");
}

main().catch((error) => {
  console.error("\nIMPORT FAILED:", error.message);
  process.exit(1);
});
