import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import * as schema from "./schema";
import fs from "fs";
import path from "path";

const DB_PATH = path.resolve(__dirname, "../../data/stations.db");

export let db: ReturnType<typeof drizzle<typeof schema>>;
let sqlDb: any;

export async function initDb() {
  const SQL = await initSqlJs();

  let buffer: Uint8Array | undefined;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }

  sqlDb = new SQL.Database(buffer);
  sqlDb.run("PRAGMA foreign_keys = ON");

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      type TEXT NOT NULL CHECK(type IN ('train_station','airport')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('train','flight')),
      date TEXT NOT NULL,
      departure_time TEXT NOT NULL,
      arrival_time TEXT NOT NULL,
      timezone TEXT NOT NULL,
      departure_station_id INTEGER NOT NULL REFERENCES stations(id),
      arrival_station_id INTEGER NOT NULL REFERENCES stations(id),
      operator TEXT NOT NULL,
      train_flight_number TEXT NOT NULL,
      train_name TEXT,
      vehicle_type TEXT,
      vehicle_number TEXT,
      duration_minutes INTEGER,
      distance_km REAL,
      cost REAL,
      currency TEXT,
      seat_number TEXT,
      seat_class TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db = drizzle(sqlDb, { schema });
}

export function saveDb() {
  if (!sqlDb) return;
  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

export { schema };
