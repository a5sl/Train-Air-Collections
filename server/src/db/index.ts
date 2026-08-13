import initSqlJs from "sql.js";
import { drizzle } from "drizzle-orm/sql-js";
import { seedSchema, userSchema } from "./schema";
import { airports } from "./schema";
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
let SQLjs: any;

/** Ensure the trips table carries every column added by later updates.
 *  Runs at startup and again after a backup restore, so restoring an
 *  older backup never leaves the live database missing columns. */
function ensureTripColumns() {
  if (!userSqlDb) return;
  const colsRes = userSqlDb.exec("PRAGMA table_info(trips)");
  const cols = new Set((colsRes[0]?.values ?? []).map((r: any[]) => String(r[1])));
  const additions: Array<[string, string]> = [
    ["is_codeshare", "INTEGER DEFAULT 0 NOT NULL"],
    ["operating_carrier", "TEXT"],
    ["operating_flight_number", "TEXT"],
    ["actual_departure_time", "TEXT"],
    ["actual_arrival_time", "TEXT"],
  ];
  let changed = false;
  for (const [name, def] of additions) {
    if (!cols.has(name)) {
      console.log("Migrating trips: adding " + name + " column...");
      userSqlDb.run("ALTER TABLE trips ADD COLUMN " + name + " " + def);
      changed = true;
    }
  }
  if (changed) saveUserDb();
}

export async function initDb() {
  const SQL = await initSqlJs();
  SQLjs = SQL;

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
        is_codeshare INTEGER DEFAULT 0 NOT NULL,
        operating_carrier TEXT,
        operating_flight_number TEXT,
        actual_departure_time TEXT,
        actual_arrival_time TEXT,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL,
        updated_at TEXT DEFAULT (datetime('now')) NOT NULL
      )
    `);
    saveUserDb();
  }

  // Migrate existing trips table: add any columns introduced by later updates
  ensureTripColumns();

  // Create trip_images table if it doesn't exist
  const imagesTableExists = userSqlDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='trip_images'"
  );
  if (imagesTableExists.length === 0) {
    console.log("Creating trip_images table in user.db...");
    userSqlDb.run(`
      CREATE TABLE trip_images (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        trip_id INTEGER NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT,
        mime TEXT NOT NULL,
        size INTEGER NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL
      )
    `);
    userSqlDb.run("CREATE INDEX IF NOT EXISTS idx_trip_images_trip ON trip_images(trip_id)");
    saveUserDb();
  }

  // Ensure airports table exists
  const airportsTableExists = seedSqlDb.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='airports'"
  );
  if (airportsTableExists.length === 0) {
    console.log("Creating airports table in seed.db...");
    seedSqlDb.run(`
      CREATE TABLE airports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        code TEXT,
        city TEXT NOT NULL,
        country TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        type TEXT NOT NULL DEFAULT 'airport',
        timezone TEXT,
        created_at TEXT DEFAULT (datetime('now')) NOT NULL
      )
    `);
    saveSeedDb();
  }

  userDb = drizzle(userSqlDb, { schema: userSchema });

  // Drop image metadata rows whose files are missing (DB-only restore / manual cleanup)
  const orphaned = reconcileTripImages();
  if (orphaned > 0) console.log("Startup: dropped " + orphaned + " image row(s) with missing files");

  // 启动时滚动自动备份用户数据（非致命，延迟到事件循环空闲时）
  setImmediate(() => startupAutoBackup());
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

/** Drop trip_images rows whose files are missing on disk. DB-only backups do
 *  not include the uploads directory, so a restore (or manual file cleanup)
 *  can leave dangling metadata that would render as broken images. Orphaned
 *  files themselves are left untouched. Returns the number of rows removed. */
export function reconcileTripImages(): number {
  if (!userSqlDb) return 0;
  let rows: { id: number; filename: string }[] = [];
  try {
    const res = userSqlDb.exec("SELECT id, filename FROM trip_images");
    rows = (res?.[0]?.values ?? []).map((v: any[]) => ({ id: Number(v[0]), filename: String(v[1] ?? "") }));
  } catch {
    return 0; // trip_images table not present yet
  }
  const missingIds = rows
    .filter((r) => !/^[\w-]+\.(jpg|jpeg|png|webp|gif)$/i.test(r.filename) || !fs.existsSync(path.resolve(UPLOADS_DIR, r.filename)))
    .map((r) => r.id);
  if (missingIds.length === 0) return 0;
  for (let i = 0; i < missingIds.length; i += 500) {
    const chunk = missingIds.slice(i, i + 500);
    userSqlDb.run("DELETE FROM trip_images WHERE id IN (" + chunk.join(",") + ")");
  }
  saveUserDb();
  return missingIds.length;
}

// ==================== Backup / Restore ====================

const BACKUPS_DIR = path.resolve(DATA_DIR, "backups");
export const UPLOADS_DIR = path.resolve(DATA_DIR, "uploads");
const MAX_AUTO_BACKUPS = 10;

function timestampTag(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() + p(d.getMonth() + 1) + p(d.getDate()) +
    "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) +
    "-" + String(d.getMilliseconds()).padStart(3, "0")
  );
}

/** Export the live in-memory user.db as a SQLite file buffer. */
export function exportUserDb(): Buffer {
  if (!userSqlDb) throw new Error("Database not initialized");
  return Buffer.from(userSqlDb.export());
}

const REQUIRED_TRIP_COLUMNS = [
  "type", "departure_date", "arrival_date", "departure_station_id",
  "arrival_station_id", "operator", "train_flight_number",
];

let restoreInProgress = false;

/** Validate a backup buffer, then replace the live user.db with it. */
export function restoreUserDbFromBuffer(buf: Buffer): { tripCount: number } {
  if (!SQLjs) throw new Error("Database not initialized");
  if (restoreInProgress) throw new Error("A restore is already in progress");
  if (!buf || buf.length === 0) throw new Error("Backup file is empty");
  if (buf.subarray(0, 16).toString("ascii") !== "SQLite format 3\u0000") {
    throw new Error("Not a valid SQLite backup file");
  }
  restoreInProgress = true;
  let restored: any = null;
  try {
    try {
      restored = new SQLjs.Database(new Uint8Array(buf));
    } catch {
      throw new Error("Not a valid SQLite backup file");
    }
    const tables = restored.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='trips'"
    );
    if (!tables || tables.length === 0) {
      throw new Error("Backup does not contain a trips table");
    }
    const colsRes = restored.exec("PRAGMA table_info(trips)");
    const cols = new Set((colsRes?.[0]?.values ?? []).map((r: any[]) => String(r[1])));
    const missing = REQUIRED_TRIP_COLUMNS.filter((c) => !cols.has(c));
    if (missing.length > 0) {
      throw new Error("Backup trips table is missing columns: " + missing.join(", "));
    }
    const countRes = restored.exec("SELECT COUNT(*) FROM trips");
    const tripCount = Number(countRes?.[0]?.values?.[0]?.[0] ?? 0);
    // Keep a safety copy of the current database before overwriting
    try {
      if (fs.existsSync(USER_PATH)) {
        fs.mkdirSync(BACKUPS_DIR, { recursive: true });
        fs.copyFileSync(
          USER_PATH,
          path.resolve(BACKUPS_DIR, "user-pre-restore-" + timestampTag() + ".db")
        );
        prunePreRestoreBackups();
      }
    } catch (e) {
      console.warn("Could not write pre-restore safety backup:", e);
    }
    try { restored.run("PRAGMA foreign_keys = ON"); } catch { /* ignore */ }
    const oldSqlDb = userSqlDb;
    userSqlDb = restored;
    restored = null; // ownership transferred to the live instance
    userDb = drizzle(userSqlDb, { schema: userSchema });
    ensureTripColumns();
    saveUserDb();
    const removedImages = reconcileTripImages();
    if (removedImages > 0) console.log("Restore: dropped " + removedImages + " image row(s) with missing files");
    try { oldSqlDb?.close(); } catch { /* ignore */ }
    return { tripCount };
  } finally {
    if (restored) { try { restored.close(); } catch { /* ignore */ } }
    restoreInProgress = false;
  }
}

export interface BackupInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUPS_DIR)) return [];
  return fs
    .readdirSync(BACKUPS_DIR)
    .filter((n) => /^user-[\w-]+\.db$/.test(n))
    .flatMap((name) => {
      try {
        const st = fs.statSync(path.resolve(BACKUPS_DIR, name));
        return [{ name, size: st.size, modifiedAt: st.mtime.toISOString() }];
      } catch {
        return []; // file vanished between readdir and stat
      }
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export function restoreBackupByName(name: string): { tripCount: number } {
  if (!/^user-[\w-]+\.db$/.test(name)) throw new Error("Invalid backup name");
  const resolved = path.resolve(BACKUPS_DIR, name);
  if (!resolved.startsWith(BACKUPS_DIR + path.sep)) throw new Error("Invalid backup path");
  if (!fs.existsSync(resolved)) throw new Error("Backup not found");
  return restoreUserDbFromBuffer(fs.readFileSync(resolved));
}

const MAX_PRE_RESTORE_BACKUPS = 5;

function prunePreRestoreBackups(): void {
  try {
    const olds = fs
      .readdirSync(BACKUPS_DIR)
      .filter((n) => /^user-pre-restore-[\w.-]+\.db$/.test(n))
      .sort()
      .reverse();
    for (const old of olds.slice(MAX_PRE_RESTORE_BACKUPS)) {
      try { fs.unlinkSync(path.resolve(BACKUPS_DIR, old)); } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
}

/** Copy the live user.db into backups/ and prune old copies. Never throws. */
export function startupAutoBackup(): void {
  try {
    if (!userSqlDb) return;
    const countRes = userSqlDb.exec("SELECT COUNT(*) FROM trips");
    const tripCount = Number(countRes?.[0]?.values?.[0]?.[0] ?? 0);
    if (tripCount === 0) return; // fresh database, nothing to protect
    const data = userSqlDb.export();
    if (!data || data.byteLength === 0) return;
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    const file = path.resolve(BACKUPS_DIR, "user-" + timestampTag() + ".db");
    fs.writeFileSync(file, Buffer.from(data));
    const olds = fs
      .readdirSync(BACKUPS_DIR)
      .filter((n) => /^user-\d{8}-\d{6}(?:-\d{3})?\.db$/.test(n))
      .sort()
      .reverse();
    for (const old of olds.slice(MAX_AUTO_BACKUPS)) {
      try { fs.unlinkSync(path.resolve(BACKUPS_DIR, old)); } catch { /* ignore */ }
    }
    console.log("Auto-backup written: " + path.basename(file) + " (" + tripCount + " trips)");
  } catch (e) {
    console.warn("Auto-backup failed (non-fatal):", e);
  }
}

