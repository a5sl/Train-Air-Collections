-- Train-Air Collections — D1 schema (all DBs merged into one D1 database)
-- Matches server/src/db/schema.ts column names.

CREATE TABLE stations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  type TEXT NOT NULL,
  timezone TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_stations_name ON stations(name);

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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_airports_name ON airports(name);

CREATE TABLE operators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT,
  type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_trips_departure_date ON trips(departure_date);

CREATE TABLE trip_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  trip_id INTEGER NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_trip_images_trip ON trip_images(trip_id);