import { trips, stations } from "./schema";
import type { Dbs } from "../db";

// --- Station helpers (used by the CSV importer to build the lookup map) ---

export async function getStations(dbs: Dbs) {
  return (await dbs.seed.select().from(stations).all()) as any[];
}

// --- Trip CRUD (used by the CSV importer) ---

export async function createTrip(dbs: Dbs, data: any): Promise<any> {
  const now = new Date().toISOString();
  return dbs.user.insert(trips).values({
    type: data.type,
    departureDate: data.departureDate,
    arrivalDate: data.arrivalDate,
    departureTime: data.departureTime,
    arrivalTime: data.arrivalTime,
    departureTimezone: data.departureTimezone,
    arrivalTimezone: data.arrivalTimezone,
    departureStationId: data.departureStationId,
    arrivalStationId: data.arrivalStationId,
    operator: data.operator,
    trainFlightNumber: data.trainFlightNumber,
    trainName: data.trainName ?? null,
    vehicleType: data.vehicleType ?? null,
    vehicleNumber: data.vehicleNumber ?? null,
    carriageNumber: data.carriageNumber ?? null,
    durationMinutes: data.durationMinutes ?? null,
    distanceKm: data.distanceKm ?? null,
    cost: data.cost ?? null,
    currency: data.currency ?? null,
    seatNumber: data.seatNumber ?? null,
    seatClass: data.seatClass ?? null,
    notes: data.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }).returning().get();
}