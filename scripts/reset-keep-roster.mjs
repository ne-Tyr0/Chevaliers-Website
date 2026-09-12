/**
 * Clear the club's play data and keep the roster.
 *
 * Deletes every season, and with it every round, matchup and game, because
 * those all cascade from the season. Players are left exactly as they are:
 * names, grades, pairing numbers and active flags all survive.
 *
 * After this the site shows its empty state and an officer starts a season
 * when the club is ready. The next round they open is round 1.
 *
 * Destructive. Run with --confirm.
 *
 *   node scripts/reset-keep-roster.mjs --confirm
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#") && l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]),
  );
}

async function main() {
  const env = loadEnv();
  const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const counts = {};
  for (const table of ["players", "seasons", "rounds", "pairings", "games"]) {
    const { data, error } = await db.from(table).select("id");
    if (error) throw new Error(`${table}: ${error.message}`);
    counts[table] = data.length;
  }

  console.log("before:");
  for (const [table, n] of Object.entries(counts)) {
    console.log(`  ${table.padEnd(9)} ${n}`);
  }

  if (!process.argv.includes("--confirm")) {
    console.log("\nWould delete every season, and with it all rounds, matchups");
    console.log(`and games. Would keep all ${counts.players} players untouched.`);
    console.log("\nDry run. Nothing written. Re-run with --confirm to apply.");
    return;
  }

  console.log("\ndeleting...");
  const { data: seasons } = await db.from("seasons").select("id, name");
  for (const season of seasons ?? []) {
    const { error } = await db.from("seasons").delete().eq("id", season.id);
    if (error) throw new Error(`${season.name}: ${error.message}`);
    console.log(`  season "${season.name}" (rounds, matchups and games cascade)`);
  }

  // Rounds are keyed to a season, so nothing should survive it. Check rather
  // than assume: an orphan round would leave the site in a state where a
  // season cannot be started.
  console.log("\nafter:");
  const after = {};
  for (const table of ["players", "seasons", "rounds", "pairings", "games"]) {
    const { data, error } = await db.from(table).select("id");
    if (error) throw new Error(`${table}: ${error.message}`);
    after[table] = data.length;
    console.log(`  ${table.padEnd(9)} ${data.length}`);
  }

  const problems = [];
  if (after.players !== counts.players) {
    problems.push(`roster changed: ${counts.players} -> ${after.players}`);
  }
  for (const table of ["seasons", "rounds", "pairings", "games"]) {
    if (after[table] !== 0) problems.push(`${after[table]} ${table} left behind`);
  }

  if (problems.length > 0) {
    throw new Error(problems.join("; "));
  }
  console.log("\nroster intact, everything else cleared.");
}

main().catch((error) => {
  console.error("\nRESET FAILED:", error.message);
  process.exit(1);
});
