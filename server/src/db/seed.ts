import { getStations, writeJson, createTrip } from "./store";
import { chinaRailStations } from "./seed-china-rail";
import { chinaAirports } from "./seed-china-air";
import { intlAirports } from "./seed-intl-air";
import { intlRailStations } from "./seed-intl-rail";
import { seedOperators } from "./seed-operators";
import fs from "fs";
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATA_DIR = path.resolve(__dirname, "../../data");

// ---- Operators Store ----

export interface Operator {
  id: number; name: string; type: "railway" | "airline" | "other";
  createdAt: string;
}

export function getOperators(q?: string) {
  const fp = path.join(DATA_DIR, "operators.json");
  if (!fs.existsSync(fp)) return [];
  const ops = JSON.parse(fs.readFileSync(fp, "utf-8")) as Operator[];
  if (!q) return ops.slice(0, 100);
  const lq = q.toLowerCase();
  return ops.filter(
    (o) => o.name.toLowerCase().includes(lq)
  ).slice(0, 20);
}

export function addOperator(data: { name: string; type: string }) {
  const fp = path.join(DATA_DIR, "operators.json");
  const ops: Operator[] = fs.existsSync(fp) ? JSON.parse(fs.readFileSync(fp, "utf-8")) : [];
  const id = ops.length > 0 ? Math.max(...ops.map(o => o.id)) + 1 : 1;
  const op: Operator = { ...data, id, type: data.type as any, createdAt: new Date().toISOString() };
  ops.push(op);
  fs.writeFileSync(fp, JSON.stringify(ops, null, 2), "utf-8");
  return op;
}

// ---- Seed Functions ----

export function seedStations() {
  const existing = getStations();
  if (existing.length > 0) return existing.length;
  const all = [...chinaRailStations, ...chinaAirports, ...intlAirports, ...intlRailStations];
  const stations = all.map((s, i) => ({
    id: i + 1,
    name: s.name, code: s.code, city: s.city, country: s.country,
    latitude: s.lat, longitude: s.lng,
    type: s.type, createdAt: new Date().toISOString(),
  }));
  writeJson("stations.json", stations);
  return stations.length;
}

export function seedOperatorsData() {
  const fp = path.join(DATA_DIR, "operators.json");
  if (fs.existsSync(fp)) {
    const existing = JSON.parse(fs.readFileSync(fp, "utf-8"));
    return existing.length;
  }
  const ops = seedOperators.map((o, i) => ({
    ...o, id: i + 1, createdAt: new Date().toISOString(),
  }));
  fs.writeFileSync(fp, JSON.stringify(ops, null, 2), "utf-8");
  return ops.length;
}

// ---- CSV Import ----

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

  const stations = getStations();
  const stationByName = new Map<string, number>();
  stations.forEach(s => stationByName.set(s.name.toLowerCase(), s.id));

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

    if (depId === undefined) {
      errors.push(`Row ${i + 1}: station not found: "${depName}"`);
      continue;
    }
    if (arrId === undefined) {
      errors.push(`Row ${i + 1}: station not found: "${arrName}"`);
      continue;
    }

    try {
      createTrip({
        type: row["type"] as any,
        date: row["date"],
        departureTime: row["departuretime"],
        arrivalTime: row["arrivaltime"],
        timezone: row["timezone"],
        departureStationId: depId,
        arrivalStationId: arrId,
        operator: row["operator"],
        trainFlightNumber: row["trainflightnumber"],
        trainName: row["trainname"] || null,
        vehicleType: row["vehicletype"] || null,
        vehicleNumber: row["vehiclenumber"] || null,
        carriageNumber: row["carriagenumber"] || null,
        durationMinutes: row["durationminutes"] ? parseInt(row["durationminutes"]) : null,
        distanceKm: row["distancekm"] ? parseFloat(row["distancekm"]) : null,
        cost: row["cost"] ? parseFloat(row["cost"]) : null,
        currency: row["currency"] || null,
        seatNumber: row["seatnumber"] || null,
        seatClass: row["seatclass"] || null,
        notes: row["notes"] || null,
      });
      imported++;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  return { imported, errors };
}
