// One-time migration: import JSON data into SQLite
// Run with: npx tsx src/db/migrate.ts

import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, "../../data");
const DB_PATH = path.join(DATA_DIR, "data.db");

async function main() {
  const SQL = await initSqlJs();

  // Create or open database
  let buffer: Buffer | undefined;
  if (fs.existsSync(DB_PATH)) {
    buffer = fs.readFileSync(DB_PATH);
  }
  const sqlDb = new SQL.Database(buffer);
  sqlDb.run("PRAGMA foreign_keys = ON");

    // Create tables if not exist
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS stations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT,
      city TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      type TEXT NOT NULL CHECK(type IN ('train_station','airport')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY,
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
    )
  `);
  sqlDb.run(`
    CREATE TABLE IF NOT EXISTS operators (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('railway','airline','other')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

// --- Import stations ---
  const stationsPath = path.join(DATA_DIR, "stations.json");
  if (fs.existsSync(stationsPath)) {
    const stations = JSON.parse(fs.readFileSync(stationsPath, "utf-8"));
    console.log(`Found ${stations.length} stations in JSON`);

    const count = sqlDb.exec("SELECT COUNT(*) as c FROM stations")[0]?.values[0][0] as number;
    if (count === 0) {
      const stmt = sqlDb.prepare(
        "INSERT INTO stations (id, name, code, city, country, latitude, longitude, type, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const s of stations) {
        stmt.run([s.id, s.name, s.code, s.city, s.country, s.latitude, s.longitude, s.type, s.createdAt]);
      }
      stmt.free();
      console.log(`Imported ${stations.length} stations`);
    } else {
      console.log(`Stations table already has ${count} rows, skipping`);
    }
  }

  // --- Import trips ---
  const tripsPath = path.join(DATA_DIR, "trips.json");
  if (fs.existsSync(tripsPath)) {
    const trips = JSON.parse(fs.readFileSync(tripsPath, "utf-8"));
    console.log(`Found ${trips.length} trips in JSON`);

    const count = sqlDb.exec("SELECT COUNT(*) as c FROM trips")[0]?.values[0][0] as number;
    if (count === 0) {
      const stmt = sqlDb.prepare(
        "INSERT INTO trips (id, type, date, departure_time, arrival_time, timezone, departure_station_id, arrival_station_id, operator, train_flight_number, train_name, vehicle_type, vehicle_number, carriage_number, duration_minutes, distance_km, cost, currency, seat_number, seat_class, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      );
      for (const t of trips) {
        stmt.run([
          t.id, t.type, t.date, t.departureTime, t.arrivalTime, t.timezone,
          t.departureStationId, t.arrivalStationId, t.operator, t.trainFlightNumber,
          t.trainName, t.vehicleType, t.vehicleNumber, t.carriageNumber,
          t.durationMinutes, t.distanceKm, t.cost, t.currency,
          t.seatNumber, t.seatClass, t.notes, t.createdAt, t.updatedAt,
        ]);
      }
      stmt.free();
      console.log(`Imported ${trips.length} trips`);
    } else {
      console.log(`Trips table already has ${count} rows, skipping`);
    }
  }

  // --- Import operators ---
  const operatorsPath = path.join(DATA_DIR, "operators.json");
  if (fs.existsSync(operatorsPath)) {
    const operators = JSON.parse(fs.readFileSync(operatorsPath, "utf-8"));
    console.log(`Found ${operators.length} operators in JSON`);

    const count = sqlDb.exec("SELECT COUNT(*) as c FROM operators")[0]?.values[0][0] as number;
    if (count === 0) {
      const stmt = sqlDb.prepare(
        "INSERT INTO operators (id, name, type, created_at) VALUES (?, ?, ?, ?)"
      );
      for (const o of operators) {
        stmt.run([o.id, o.name, o.type, o.createdAt]);
      }
      stmt.free();
      console.log(`Imported ${operators.length} operators`);
    } else {
      console.log(`Operators table already has ${count} rows, skipping`);
    }
  }

  // Save
  const data = sqlDb.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  console.log(`Database saved to ${DB_PATH}`);

  // Verify
  const stationsCount = sqlDb.exec("SELECT COUNT(*) as c FROM stations")[0]?.values[0][0];
  const tripsCount = sqlDb.exec("SELECT COUNT(*) as c FROM trips")[0]?.values[0][0];
  const operatorsCount = sqlDb.exec("SELECT COUNT(*) as c FROM operators")[0]?.values[0][0];
  console.log(`\nVerification: ${stationsCount} stations, ${tripsCount} trips, ${operatorsCount} operators`);

  sqlDb.close();
}

main().catch(console.error);
