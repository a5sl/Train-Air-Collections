import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  ensureDir();
  const fp = path.join(DATA_DIR, file);
  if (!fs.existsSync(fp)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson<T>(file: string, data: T): void {
  ensureDir();
  fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify(data, null, 2), "utf-8");
}

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

let nextId = 1;

export function getStations(): Station[] {
  return readJson<Station[]>("stations.json", []);
}

export function getStation(id: number): Station | undefined {
  return getStations().find((s) => s.id === id);
}

export function createStation(data: Omit<Station, "id" | "createdAt">): Station {
  const stations = getStations();
  const ids = stations.map((s) => s.id);
  const id = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  const station: Station = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
  };
  stations.push(station);
  writeJson("stations.json", stations);
  return station;
}

export function getTrips(): Trip[] {
  return readJson<Trip[]>("trips.json", []);
}

export function getTrip(id: number): Trip | undefined {
  return getTrips().find((t) => t.id === id);
}

export function createTrip(data: Omit<Trip, "id" | "createdAt" | "updatedAt">): Trip {
  const trips = getTrips();
  const ids = trips.map((t) => t.id);
  const id = ids.length > 0 ? Math.max(...ids) + 1 : 1;
  const trip: Trip = {
    ...data,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  trips.unshift(trip);
  writeJson("trips.json", trips);
  return trip;
}

export function updateTrip(id: number, data: Partial<Omit<Trip, "id" | "createdAt" | "updatedAt">>): Trip | null {
  const trips = getTrips();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  trips[idx] = { ...trips[idx], ...data, updatedAt: new Date().toISOString() };
  writeJson("trips.json", trips);
  return trips[idx];
}

export function deleteTrip(id: number): boolean {
  const trips = getTrips();
  const idx = trips.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  trips.splice(idx, 1);
  writeJson("trips.json", trips);
  return true;
}
