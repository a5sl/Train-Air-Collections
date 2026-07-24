import Database from "better-sqlite3";
import path from "path";

const DB_PATH = path.resolve(__dirname, "../../data/stations.db");

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

// Create tables
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS stations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    code TEXT,
    city TEXT NOT NULL,
    country TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    type TEXT NOT NULL CHECK(type IN ('train_station','airport')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

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
    carriage_number TEXT,
    duration_minutes INTEGER,
    distance_km REAL,
    cost REAL,
    currency TEXT,
    seat_number TEXT,
    seat_class TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

console.log("Database schema pushed successfully!");
sqlite.close();
