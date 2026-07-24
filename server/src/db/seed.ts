import { sql } from "drizzle-orm";
import { seedDb, saveSeedDb } from "./index";
import { stations, operators } from "./schema";
import { getStations, createTrip } from "./store";
import { chinaRailStations } from "./seed-china-rail";
import { chinaAirports } from "./seed-china-air";
import { intlAirports } from "./seed-intl-air";
import { intlRailStations } from "./seed-intl-rail";
import { seedOperators } from "./seed-operators";
import { computeDuration, computeDistance } from "../geo";

// --- Operators CRUD ---

export interface Operator {
  id: number; name: string; type: "railway" | "airline" | "other";
  createdAt: string;
}

export function getOperators(q?: string) {
  if (!q) return seedDb.select().from(operators).orderBy(sql`type, name`).all() as Operator[];
  return seedDb.select().from(operators).where(
    sql`(${operators.name} LIKE ${"%" + q + "%"} OR ${operators.code} LIKE ${q.toUpperCase() + "%"})`
  ).orderBy(sql`CASE WHEN ${operators.code} LIKE ${q.toUpperCase() + "%"} THEN 0 ELSE 1 END, name`).limit(20).all() as Operator[];
}

export function addOperator(data: { name: string; type: string }) {
  const now = new Date().toISOString();
  const result = seedDb.insert(operators).values({
    name: data.name,
    code: null,
    type: data.type as any,
    createdAt: now,
  }).returning().get() as Operator;
  saveSeedDb();
  return result;
}

// --- Seed Functions (use raw SQL for performance) ---

export function seedStations(): number {
  const count = seedDb.select().from(stations).get() as any;
  if (count.c > 0) return count.c as number;

  const all = [...chinaRailStations, ...chinaAirports, ...intlAirports, ...intlRailStations];
  const now = new Date().toISOString();
  for (let i = 0; i < all.length; i++) {
    const s = all[i];
    seedDb.insert(stations).values({
      name: s.name, code: s.code, city: s.city, country: s.country,
      latitude: s.lat, longitude: s.lng, type: s.type, createdAt: now,
      timezone: null,
    }).run();
  }
  saveSeedDb();
  return all.length;
}

export function seedOperatorsData(): number {
  const count = seedDb.select().from(operators).get() as any;
  if (count.c > 0) return count.c as number;

  const now = new Date().toISOString();
  for (const o of seedOperators) {
    seedDb.insert(operators).values({
      name: o.name, type: o.type as any, createdAt: now,
    }).run();
  }
  saveSeedDb();
  return seedOperators.length;
}

// --- CSV Import ---

export function importTripsFromCSV(csvText: string): { imported: number; errors: string[] } {
  const errors: string[] = [];
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { imported: 0, errors: ["CSV must have a header row and at least one data row"] };

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const requiredCols = ["type","departuredate","arrivaldate","departuretime","arrivaltime","departurestationname","arrivalstationname","operator","trainflightnumber"];
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

    // Fuzzy station name matching
    const findStation = (name: string): number | undefined => {
      const key = name.toLowerCase();
      // 1. Exact match
      if (stationByName.has(key)) return stationByName.get(key);
      // 2. Add 站 suffix (Chinese)
      if (stationByName.has(key + "站")) return stationByName.get(key + "站");
      // 3. Add 駅 suffix (Japanese)
      if (stationByName.has(key + "駅")) return stationByName.get(key + "駅");
      // 4. Remove trailing 站 or 駅
      if ((key.endsWith("站") || key.endsWith("駅")) && stationByName.has(key.slice(0, -1))) return stationByName.get(key.slice(0, -1));
      // 5. Try replacing 站 with 駅 and vice versa
      if (key.endsWith("站")) {
        const alt = key.slice(0, -1) + "駅";
        if (stationByName.has(alt)) return stationByName.get(alt);
      }
      if (key.endsWith("駅")) {
        const alt = key.slice(0, -1) + "站";
        if (stationByName.has(alt)) return stationByName.get(alt);
      }
      return undefined;
    };
    // Auto-create unknown stations in seed.db so future imports work
    let depId = findStation(depName);
    if (depId === undefined) {
      try {
        const newStation = seedDb.insert(stations).values({
          name: depName,
          city: depName,
          country: "中国",
          type: row["type"] === "flight" ? "airport" : "train_station",
          createdAt: new Date().toISOString(),
        }).returning().get() as any;
        saveSeedDb();
        if (newStation?.id) {
          stationByName.set(depName.toLowerCase(), newStation.id);
          depId = newStation.id;
          console.log(`Auto-created station: ${depName} (id=${newStation.id})`);
        }
      } catch (e: any) { /* ignore duplicate insert errors */ }
    }
    let arrId = findStation(arrName);
    if (arrId === undefined) {
      try {
        const newStation = seedDb.insert(stations).values({
          name: arrName,
          city: arrName,
          country: "中国",
          type: row["type"] === "flight" ? "airport" : "train_station",
          createdAt: new Date().toISOString(),
        }).returning().get() as any;
        saveSeedDb();
        if (newStation?.id) {
          stationByName.set(arrName.toLowerCase(), newStation.id);
          arrId = newStation.id;
          console.log(`Auto-created station: ${arrName} (id=${newStation.id})`);
        }
      } catch (e: any) { /* ignore duplicate insert errors */ }
    }
    if (depId === undefined) { errors.push(`Row ${i + 1}: station not found: "${depName}"`); continue; }
    if (arrId === undefined) { errors.push(`Row ${i + 1}: station not found: "${arrName}"`); continue; }

    try {
      const depDate = row["departuredate"] || row["date"] || "";
      const arrDate = row["arrivaldate"] || row["date"] || "";
      const depTimezone = "Asia/Shanghai";
      const arrTimezone = "Asia/Shanghai";
      const ds = seedDb.select().from(stations).where(eq(stations.id, depId)).get() as any;
      const as = seedDb.select().from(stations).where(eq(stations.id, arrId)).get() as any;
      const computedDist = computeDistance(ds?.latitude, ds?.longitude, as?.latitude, as?.longitude);
      const computedDur = computeDuration(depDate, row["departuretime"], depTimezone, arrDate, row["arrivaltime"], arrTimezone);
      createTrip({
        type: row["type"] as any, departureDate: depDate, arrivalDate: arrDate,
        departureTime: row["departuretime"], arrivalTime: row["arrivaltime"],
        departureTimezone: depTimezone, arrivalTimezone: arrTimezone,
        departureStationId: depId, arrivalStationId: arrId,
        operator: row["operator"], trainFlightNumber: row["trainflightnumber"],
        trainName: row["trainname"] || null, vehicleType: row["vehicletype"] || null,
        vehicleNumber: row["vehiclenumber"] || null, carriageNumber: row["carriagenumber"] || null,
        durationMinutes: row["durationminutes"] ? parseInt(row["durationminutes"]) : (computedDur ?? null),
        distanceKm: row["distancekm"] ? parseFloat(row["distancekm"]) : (computedDist ?? null),
        cost: row["cost"] ? parseFloat(row["cost"]) : null,
        currency: row["currency"] || null, seatNumber: row["seatnumber"] || null,
        seatClass: row["seatclass"] || null, notes: row["notes"] || null,
      });      imported++;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  return { imported, errors };
}
