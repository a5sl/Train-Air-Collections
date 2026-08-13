import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ==================== Seed schema (seed.db): stations + airports + operators ====================

export const stations = sqliteTable("stations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  type: text("type", { enum: ["train_station", "airport"] }).notNull(),
  timezone: text("timezone"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const operators = sqliteTable("operators", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code"),
  type: text("type", { enum: ["railway", "airline", "other"] }).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const airports = sqliteTable("airports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  type: text("type", { enum: ["airport"] }).notNull().default("airport"),
  timezone: text("timezone"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const seedSchema = { stations, airports, operators };

// ==================== User schema (user.db): trips only ====================
// NOTE: cross-db FK not supported; station IDs are plain integers.

export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["train", "flight"] }).notNull(),
  departureDate: text("departure_date").notNull(),
  arrivalDate: text("arrival_date").notNull(),
  departureTime: text("departure_time").notNull(),
  arrivalTime: text("arrival_time").notNull(),
  actualDepartureTime: text("actual_departure_time"),
  actualArrivalTime: text("actual_arrival_time"),
  departureTimezone: text("departure_timezone").notNull(),
  arrivalTimezone: text("arrival_timezone").notNull(),
  departureStationId: integer("departure_station_id").notNull(),
  arrivalStationId: integer("arrival_station_id").notNull(),
  operator: text("operator").notNull(),
  trainFlightNumber: text("train_flight_number").notNull(),
  trainName: text("train_name"),
  vehicleType: text("vehicle_type"),
  vehicleNumber: text("vehicle_number"),
  carriageNumber: text("carriage_number"),
  durationMinutes: integer("duration_minutes"),
  distanceKm: real("distance_km"),
  cost: real("cost"),
  currency: text("currency"),
  seatNumber: text("seat_number"),
  seatClass: text("seat_class"),
  notes: text("notes"),
  isCodeshare: integer("is_codeshare").notNull().default(0),
  operatingCarrier: text("operating_carrier"),
  operatingFlightNumber: text("operating_flight_number"),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

export const tripImages = sqliteTable("trip_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tripId: integer("trip_id").notNull(),
  filename: text("filename").notNull(),
  originalName: text("original_name"),
  mime: text("mime").notNull(),
  size: integer("size").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const userSchema = { trips, tripImages };
