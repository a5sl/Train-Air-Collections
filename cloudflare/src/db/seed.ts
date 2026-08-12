import { sql, eq, and } from "drizzle-orm";
import { stations, airports, operators } from "./schema";
import { getStations, createTrip } from "./store";
import { IATA_CODE_MAP } from "./iata-codes";
import { computeDuration, computeDistance } from "../geo";
import type { Dbs } from "../db";

export interface Operator {
  id: number; name: string; type: "railway" | "airline" | "other"; createdAt: string;
}

// --- Operators CRUD ---

export function getOperators(dbs: Dbs, q?: string, typeFilter?: string) {
  const ops = dbs.seed.select().from(operators);
  if (!q && !typeFilter) return ops.orderBy(sql`type, name`).all() as Promise<Operator[]>;
  let query: any = dbs.seed.select().from(operators);
  if (typeFilter && q) {
    query = query.where(and(eq(operators.type, typeFilter as any), sql`(${operators.name} LIKE ${"%" + q + "%"} OR ${operators.code} LIKE ${q.toUpperCase() + "%"})`));
  } else if (typeFilter) {
    query = query.where(eq(operators.type, typeFilter as any));
  } else if (q) {
    query = query.where(sql`(${operators.name} LIKE ${"%" + q + "%"} OR ${operators.code} LIKE ${q.toUpperCase() + "%"})`);
  }
  if (q) query = query.orderBy(sql`CASE WHEN ${operators.code} LIKE ${q.toUpperCase() + "%"} THEN 0 ELSE 1 END, name`).limit(20) as any;
  return query.all() as Promise<Operator[]>;
}

export function addOperator(dbs: Dbs, data: { name: string; type: string }) {
  const now = new Date().toISOString();
  return dbs.seed.insert(operators).values({
    name: data.name,
    code: null,
    type: data.type as any,
    createdAt: now,
  }).returning().get() as Promise<Operator>;
}

// Look up an operator by exact IATA code
export function getOperatorByCode(dbs: Dbs, code: string) {
  const upper = code.toUpperCase();
  return dbs.seed.select().from(operators)
    .where(sql`${operators.code} = ${upper}`)
    .get() as Promise<Operator | undefined>;
}

// --- Regular CSV Import (byAir import was dropped for the cloud build) ---

export async function importTripsFromCSV(dbs: Dbs, csvText: string): Promise<{ imported: number; errors: string[] }> {
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

  const stats = await getStations(dbs);
  const stationByName = new Map<string, number>();
  stats.forEach((s: any) => stationByName.set(s.name.toLowerCase(), s.id));

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

    const findStation = (name: string): number | undefined => {
      const key = name.toLowerCase();
      if (stationByName.has(key)) return stationByName.get(key);
      if (stationByName.has(key + "站")) return stationByName.get(key + "站");
      if (stationByName.has(key + "駅")) return stationByName.get(key + "駅");
      if ((key.endsWith("站") || key.endsWith("駅")) && stationByName.has(key.slice(0, -1))) return stationByName.get(key.slice(0, -1));
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

    let depId = findStation(depName);
    if (depId === undefined) {
      try {
        const table = row["type"] === "flight" ? airports : stations;
        const newStation = await dbs.seed.insert(table).values({
          name: depName,
          city: depName,
          country: "中国",
          type: row["type"] === "flight" ? "airport" : "train_station",
          createdAt: new Date().toISOString(),
        }).returning().get() as any;
        if (newStation?.id) {
          stationByName.set(depName.toLowerCase(), newStation.id);
          depId = newStation.id;
        }
      } catch (e: any) { /* ignore duplicate insert errors */ }
    }
    let arrId = findStation(arrName);
    if (arrId === undefined) {
      try {
        const table = row["type"] === "flight" ? airports : stations;
        const newStation = await dbs.seed.insert(table).values({
          name: arrName,
          city: arrName,
          country: "中国",
          type: row["type"] === "flight" ? "airport" : "train_station",
          createdAt: new Date().toISOString(),
        }).returning().get() as any;
        if (newStation?.id) {
          stationByName.set(arrName.toLowerCase(), newStation.id);
          arrId = newStation.id;
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
      const ds = await dbs.seed.select().from(stations).where(eq(stations.id, depId)).get() as any;
      const as = await dbs.seed.select().from(stations).where(eq(stations.id, arrId)).get() as any;
      const computedDist = computeDistance(ds?.latitude, ds?.longitude, as?.latitude, as?.longitude);
      const computedDur = computeDuration(depDate, row["departuretime"], depTimezone, arrDate, row["arrivaltime"], arrTimezone);
      await createTrip(dbs, {
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
      });
      imported++;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  return { imported, errors };
}