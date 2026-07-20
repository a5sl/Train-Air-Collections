import { eq, desc } from "drizzle-orm";
import { db, saveDb } from "./index";
import { stations, trips } from "./schema";

// --- Station types (unchanged from JSON version) ---

export interface Station {
  id: number;
  name: string;
  code: string | null;
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  type: "train_station" | "airport";
  createdAt: string;
}

// --- Trip types (unchanged from JSON version) ---

export interface Trip {
  id: number;
  type: "train" | "flight";
  date: string;
  departureTime: string;
  arrivalTime: string;
  timezone: string;
  departureStationId: number;
  arrivalStationId: number;
  operator: string;
  trainFlightNumber: string;
  trainName: string | null;
  vehicleType: string | null;
  vehicleNumber: string | null;
  carriageNumber: string | null;
  durationMinutes: number | null;
  distanceKm: number | null;
  cost: number | null;
  currency: string | null;
  seatNumber: string | null;
  seatClass: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// --- Station CRUD ---

export function getStations(): Station[] {
  return db.select().from(stations).all() as Station[];
}

export function getStation(id: number): Station | undefined {
  return db.select().from(stations).where(eq(stations.id, id)).get() as Station | undefined;
}

export function createStation(data: Omit<Station, "id" | "createdAt">): Station {
  const now = new Date().toISOString();
  const result = db.insert(stations).values({
    name: data.name,
    code: data.code,
    city: data.city,
    country: data.country,
    latitude: data.latitude,
    longitude: data.longitude,
    type: data.type,
    timezone: null,
    createdAt: now,
  }).returning().get() as Station;
  saveDb();
  return result;
}

// --- Trip CRUD ---

export function getTrips(): Trip[] {
  const allTrips = db.select().from(trips).orderBy(desc(trips.date), desc(trips.id)).all() as Trip[];
  return allTrips;
}

export function getTrip(id: number): Trip | undefined {
  return db.select().from(trips).where(eq(trips.id, id)).get() as Trip | undefined;
}

export function createTrip(data: Omit<Trip, "id" | "createdAt" | "updatedAt">): Trip {
  const now = new Date().toISOString();
  const result = db.insert(trips).values({
    type: data.type,
    date: data.date,
    departureTime: data.departureTime,
    arrivalTime: data.arrivalTime,
    timezone: data.timezone,
    departureStationId: data.departureStationId,
    arrivalStationId: data.arrivalStationId,
    operator: data.operator,
    trainFlightNumber: data.trainFlightNumber,
    trainName: data.trainName,
    vehicleType: data.vehicleType,
    vehicleNumber: data.vehicleNumber,
    carriageNumber: data.carriageNumber,
    durationMinutes: data.durationMinutes,
    distanceKm: data.distanceKm,
    cost: data.cost,
    currency: data.currency,
    seatNumber: data.seatNumber,
    seatClass: data.seatClass,
    notes: data.notes,
    createdAt: now,
    updatedAt: now,
  }).returning().get() as Trip;
  saveDb();
  return result;
}

export function updateTrip(id: number, data: Partial<Omit<Trip, "id" | "createdAt" | "updatedAt">>): Trip | null {
  const now = new Date().toISOString();
  const updateData: Record<string, any> = { updatedAt: now };
  if (data.type !== undefined) updateData.type = data.type;
  if (data.date !== undefined) updateData.date = data.date;
  if (data.departureTime !== undefined) updateData.departureTime = data.departureTime;
  if (data.arrivalTime !== undefined) updateData.arrivalTime = data.arrivalTime;
  if (data.timezone !== undefined) updateData.timezone = data.timezone;
  if (data.departureStationId !== undefined) updateData.departureStationId = data.departureStationId;
  if (data.arrivalStationId !== undefined) updateData.arrivalStationId = data.arrivalStationId;
  if (data.operator !== undefined) updateData.operator = data.operator;
  if (data.trainFlightNumber !== undefined) updateData.trainFlightNumber = data.trainFlightNumber;
  if (data.trainName !== undefined) updateData.trainName = data.trainName;
  if (data.vehicleType !== undefined) updateData.vehicleType = data.vehicleType;
  if (data.vehicleNumber !== undefined) updateData.vehicleNumber = data.vehicleNumber;
  if (data.carriageNumber !== undefined) updateData.carriageNumber = data.carriageNumber;
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
  if (data.distanceKm !== undefined) updateData.distanceKm = data.distanceKm;
  if (data.cost !== undefined) updateData.cost = data.cost;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.seatNumber !== undefined) updateData.seatNumber = data.seatNumber;
  if (data.seatClass !== undefined) updateData.seatClass = data.seatClass;
  if (data.notes !== undefined) updateData.notes = data.notes;

  const result = db.update(trips).set(updateData).where(eq(trips.id, id)).returning().get() as Trip | undefined;
  if (result) saveDb();
  return result ?? null;
}

export function deleteTrip(id: number): boolean {
  const result = db.delete(trips).where(eq(trips.id, id)).run();
  if (result.changes > 0) {
    saveDb();
    return true;
  }
  return false;
}
