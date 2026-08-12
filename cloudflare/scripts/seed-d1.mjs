// Dump seed.db (stations/airports/operators) into SQL and apply it to D1.
// Usage: node scripts/seed-d1.mjs [--local|--remote]   (default: --local)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./run-wrangler.mjs";
import { openDb, rowsToSql } from "./sql-dump.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedDbFile = path.resolve(root, "../server/data/seed.db");
const outFile = path.join(root, "generated", "seed_data.sql");
const target = process.argv.includes("--remote") ? "--remote" : "--local";

const db = await openDb(seedDbFile);

const STATION_COLS = ["id","name","code","city","country","latitude","longitude","type","timezone","created_at"];
const OPERATOR_COLS = ["id","name","code","type","created_at"];

function dump(table, cols) {
  const res = db.exec(`SELECT ${cols.join(", ")} FROM ${table}`);
  return (res[0]?.values ?? []).map((v) => {
    const o = {};
    cols.forEach((c, i) => { o[c] = v[i]; });
    return o;
  });
}

const parts = [];
parts.push("-- Seed data generated from server/data/seed.db");
parts.push(rowsToSql("stations", STATION_COLS, dump("stations", STATION_COLS)));
parts.push(rowsToSql("airports", STATION_COLS, dump("airports", STATION_COLS)));
parts.push(rowsToSql("operators", OPERATOR_COLS, dump("operators", OPERATOR_COLS)));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, parts.join("\n\n"), "utf8");
console.log(`Generated ${outFile}`);

run(["d1", "execute", "train-air-db", target, "--file", outFile], root);
console.log("Seed data applied to D1 (" + target + ")");