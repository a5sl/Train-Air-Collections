import { sqliteTable, integer, real, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const stations = sqliteTable("stations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code"),
  city: text("city").notNull(),
  country: text("country").notNull(),
  latitude: real("latitude"),
  longitude: real("longitude"),
  type: text("type", { enum: ["train_station", "airport"] }).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});

export const trips = sqliteTable("trips", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  type: text("type", { enum: ["train", "flight"] }).notNull(),
  date: text("date").notNull(),
  departureTime: text("departure_time").notNull(),
  arrivalTime: text("arrival_time").notNull(),
  timezone: text("timezone").notNull(),
  departureStationId: integer("departure_station_id")
    .notNull()
    .references(() => stations.id),
  arrivalStationId: integer("arrival_station_id")
    .notNull()
    .references(() => stations.id),
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
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
  updatedAt: text("updated_at").default(sql`(datetime('now'))`).notNull(),
});

export const operators = sqliteTable("operators", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  code: text("code"),
  type: text("type", { enum: ["railway", "airline", "other"] }).notNull(),
  createdAt: text("created_at").default(sql`(datetime('now'))`).notNull(),
});
