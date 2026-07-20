import { sql } from "drizzle-orm";
import { db, saveDb } from "./index";
import { stations, operators } from "./schema";
import { getStations, createTrip } from "./store";
import { chinaRailStations } from "./seed-china-rail";
import { chinaAirports } from "./seed-china-air";
import { intlAirports } from "./seed-intl-air";
import { intlRailStations } from "./seed-intl-rail";
import { seedOperators } from "./seed-operators";

// --- Operators CRUD ---

export interface Operator {
  id: number; name: string; type: "railway" | "airline" | "other";
  createdAt: string;
}

export function getOperators(q?: string) {
  if (!q) return db.select().from(operators).limit(100).all() as Operator[];
  return db.select().from(operators).where(
    sql`${operators.name} LIKE ${"%" + q + "%"}`
  ).limit(20).all() as Operator[];
}

export function addOperator(data: { name: string; type: string }) {
  const now = new Date().toISOString();
  const result = db.insert(operators).values({
    name: data.name,
    type: data.type as any,
    createdAt: now,
  }).returning().get() as Operator;
  saveDb();
  return result;
}

// --- Seed Functions (use raw SQL for performance) ---

export function seedStations(): number {
  const count = db.select({ c: sql`count(*)` }).from(stations).get() as any;
  if (count.c > 0) return count.c as number;

  const all = [...chinaRailStations, ...chinaAirports, ...intlAirports, ...intlRailStations];
  const now = new Date().toISOString();
  for (let i = 0; i < all.length; i++) {
    const s = all[i];
    db.insert(stations).values({
      name: s.name, code: s.code, city: s.city, country: s.country,
      latitude: s.lat, longitude: s.lng, type: s.type, createdAt: now,
    }).run();
  }
  saveDb();
  return all.length;
}

export function seedOperatorsData(): number {
  const count = db.select({ c: sql`count(*)` }).from(operators).get() as any;
  if (count.c > 0) return count.c as number;

  const now = new Date().toISOString();
  for (const o of seedOperators) {
    db.insert(operators).values({
      name: o.name, type: o.type as any, createdAt: now,
    }).run();
  }
  saveDb();
  return seedOperators.length;
}

// --- CSV Import ---

export function importTripsFromCSV(csvText: string): { imported: number; errors: string[] } {
  const errors: string[] = [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { imported: 0, errors: ["CSV must have a header row and at least one data row"] };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const requiredCols = ["type","date","departuretime","arrivaltime","timezone","departurestationname","arrivalstationname","operator","trainflightnumber"];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      return { imported: 0, errors: [`Missing required column: ${col}`] };
    }
  }

  const stats = getStations();
  const stationByName = new Map<string, number>();
  stats.forEach(s => stationByName.set(s.name.toLowerCase(), s.id));

  let imported = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length < header.length) {
      errors.push(`Row ${i + 1}: insufficient columns`);
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((h, j) => { row[h] = cols[j] || ""; });

    const depName = row["departurestationname"] || "";
    const arrName = row["arrivalstationname"] || "";
    if (!depName || !arrName) {
      errors.push(`Row ${i + 1}: missing station names`);
      continue;
    }

    let depId = stationByName.get(depName.toLowerCase());
    let arrId = stationByName.get(arrName.toLowerCase());
    if (depId === undefined) { errors.push(`Row ${i + 1}: station not found: "${depName}"`); continue; }
    if (arrId === undefined) { errors.push(`Row ${i + 1}: station not found: "${arrName}"`); continue; }

    try {
      createTrip({
        type: row["type"] as any, date: row["date"], departureTime: row["departuretime"],
        arrivalTime: row["arrivaltime"], timezone: row["timezone"],
        departureStationId: depId, arrivalStationId: arrId,
        operator: row["operator"], trainFlightNumber: row["trainflightnumber"],
        trainName: row["trainname"] || null, vehicleType: row["vehicletype"] || null,
        vehicleNumber: row["vehiclenumber"] || null, carriageNumber: row["carriagenumber"] || null,
        durationMinutes: row["durationminutes"] ? parseInt(row["durationminutes"]) : null,
        distanceKm: row["distancekm"] ? parseFloat(row["distancekm"]) : null,
        cost: row["cost"] ? parseFloat(row["cost"]) : null,
        currency: row["currency"] || null, seatNumber: row["seatnumber"] || null,
        seatClass: row["seatclass"] || null, notes: row["notes"] || null,
      });
      imported++;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  return { imported, errors };
}
