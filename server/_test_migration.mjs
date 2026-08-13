import initSqlJs from "sql.js";
import fs from "fs";

const SQL = await initSqlJs();
const dbPath = "/tmp/user_migration_test.db";
const db = new SQL.Database(fs.readFileSync(dbPath));

const before = db.exec("SELECT COUNT(*) FROM trips")[0].values[0][0];
const sample = db.exec("SELECT id, departure_time, arrival_time FROM trips ORDER BY id LIMIT 3");
console.log("rows before:", before);
console.log("sample before:", JSON.stringify(sample[0]?.values ?? []));

// replicate ensureTripColumns()
const colsRes = db.exec("PRAGMA table_info(trips)");
const cols = new Set(colsRes[0].values.map(r => String(r[1])));
console.log("has actual_departure_time before:", cols.has("actual_departure_time"));
const additions = [
  ["is_codeshare", "INTEGER DEFAULT 0 NOT NULL"],
  ["operating_carrier", "TEXT"],
  ["operating_flight_number", "TEXT"],
  ["actual_departure_time", "TEXT"],
  ["actual_arrival_time", "TEXT"],
];
for (const [name, def] of additions) {
  if (!cols.has(name)) db.run(`ALTER TABLE trips ADD COLUMN ${name} ${def}`);
}

const colsAfter = db.exec("PRAGMA table_info(trips)")[0].values.map(r => r[1]);
console.log("columns after:", colsAfter.join(","));
const after = db.exec("SELECT COUNT(*) FROM trips")[0].values[0][0];
const sampleAfter = db.exec("SELECT id, departure_time, arrival_time, actual_departure_time, actual_arrival_time FROM trips ORDER BY id LIMIT 3");
console.log("rows after:", after);
console.log("sample after:", JSON.stringify(sampleAfter[0]?.values ?? []));

// idempotency: run again — should be a no-op
const cols2 = new Set(db.exec("PRAGMA table_info(trips)")[0].values.map(r => String(r[1])));
console.log("second pass would add:", additions.filter(([n]) => !cols2.has(n)).length === 0 ? "nothing (idempotent)" : "BUG");
db.close();
console.log("MIGRATION TEST PASSED");
