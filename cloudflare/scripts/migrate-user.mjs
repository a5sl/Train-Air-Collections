// Dump the local user.db (trips + trip_images) into SQL and apply it to D1.
// Usage: node scripts/migrate-user.mjs [--local|--remote]   (default: --local)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./run-wrangler.mjs";
import { openDb, rowsToSql } from "./sql-dump.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const userDbFile = path.resolve(root, "../server/data/user.db");
const outFile = path.join(root, "generated", "user_data.sql");
const target = process.argv.includes("--remote") ? "--remote" : "--local";

const db = await openDb(userDbFile);

const TRIP_COLS = [
  "id","type","departure_date","arrival_date","departure_time","arrival_time",
  "departure_timezone","arrival_timezone","departure_station_id","arrival_station_id",
  "operator","train_flight_number","train_name","vehicle_type","vehicle_number",
  "carriage_number","duration_minutes","distance_km","cost","currency","seat_number",
  "seat_class","notes","created_at","updated_at",
];
const IMAGE_COLS = ["id","trip_id","filename","original_name","mime","size","sort_order","created_at"];

function tableExists(name) {
  const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='" + name + "'");
  return res.length > 0 && (res[0].values?.length ?? 0) > 0;
}
function dump(table, cols) {
  const res = db.exec(`SELECT ${cols.join(", ")} FROM ${table}`);
  return (res[0]?.values ?? []).map((v) => {
    const o = {};
    cols.forEach((c, i) => { o[c] = v[i]; });
    return o;
  });
}

const parts = [];
parts.push("-- User data generated from server/data/user.db");
parts.push(tableExists("trips")
  ? rowsToSql("trips", TRIP_COLS, dump("trips", TRIP_COLS))
  : "-- no trips table found");
parts.push(tableExists("trip_images")
  ? rowsToSql("trip_images", IMAGE_COLS, dump("trip_images", IMAGE_COLS))
  : "-- no trip_images table found");

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, parts.join("\n\n"), "utf8");
console.log(`Generated ${outFile}`);

run(["d1", "execute", "train-air-db", target, "--file", outFile], root);
console.log("User data applied to D1 (" + target + ")");