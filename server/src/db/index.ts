import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import { seedSchema, userSchema } from "./schema";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../../data");
const SEED_PATH = path.resolve(DATA_DIR, "seed.db");
const USER_PATH = path.resolve(DATA_DIR, "user.db");

// --- Exported database instances ---

export let seedDb: ReturnType<typeof drizzle>;
export let userDb: ReturnType<typeof drizzle>;
let seedSqlDb: any;
let userSqlDb: any;

export async function initDb() {
  const SQL = await initSqlJs();

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  // --- Open seed.db ---
  if (!fs.existsSync(SEED_PATH)) {
    throw new Error("seed.db not found at " + SEED_PATH);
  }
  const seedBuffer = fs.readFileSync(SEED_PATH);
  seedSqlDb = new SQL.Database(seedBuffer);
  seedSqlDb.run("PRAGMA foreign_keys = ON");
  seedDb = drizzle(seedSqlDb, { schema: seedSchema });

  // --- Open / create user.db ---
  let userBuffer: Buffer | undefined;
  if (fs.existsSync(USER_PATH)) {
    userBuffer = fs.readFileSync(USER_PATH);
  }

  userSqlDb = new SQL.Database(userBuffer);
  userSqlDb.run("PRAGMA foreign_keys = ON");

  // Create trips table if it doesn't exist
  const tripsTableExists = userSqlDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='trips'"
  );
  if (tripsTableExists.length === 0) {
    console.log("Creating trips table in user.db...");
    userSqlDb.run(`
      CREATE TABLE trips (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        departure_date TEXT NOT NULL,
        arrival_date TEXT NOT NULL,
        departure_time TEXT NOT NULL,
        arrival_time TEXT NOT NULL,
        departure_timezone TEXT NOT NULL,
        arrival_timezone TEXT NOT NULL,
        departure_station_id INTEGER NOT NULL,
        arrival_station_id INTEGER NOT NULL,
        operator TEXT NOT NULL,
        train_flight_number TEXT NOT NULL,
        train_name TEXT,
        vehicle_type TEXT,
        vehicle_number TEXT,
        carriage_number TEXT,
        duration_minutes INTEGER,
        distance_km REAL,
        cost REAL,
        currency TEXT,
        seat_number TEXT,
        seat_class TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')) NOT NULL
      )
    `);
    saveUserDb();
  }

  userDb = drizzle(userSqlDb, { schema: userSchema });
}

export function saveSeedDb() {
  if (!seedSqlDb) return;
  const data = seedSqlDb.export();
  fs.writeFileSync(SEED_PATH, Buffer.from(data));
}

export function saveUserDb() {
  if (!userSqlDb) return;
  const data = userSqlDb.export();
  fs.writeFileSync(USER_PATH, Buffer.from(data));
}
