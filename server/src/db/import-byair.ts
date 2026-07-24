import fs from "fs";
import { seedDb, userDb, saveUserDb } from "./index";
import { stations, operators, trips } from "./schema";
import { eq, and } from "drizzle-orm";
import { computeDuration, computeDistance } from "../geo";

/**
 * Import flights from a byAir CSV export.
 * CSV columns:
 *   Flight Date, Flight Code, Departure Airport Code, Arrival Airport Code,
 *   Departure Time, Arrival Time, Booking Code, Seat Number, Seat Type,
 *   Seat Class, Purpose, Notes, Ownership, byAir Flight ID, byAir Codeshare ID
 */
export function importByAirFlights(csvPath: string): { imported: number; skipped: number; errors: string[] } {
  const errors: string[] = [];
  const csvText = fs.readFileSync(csvPath, "utf-8");
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { imported: 0, skipped: 0, errors: ["CSV must have a header row and at least one data row"] };

  const header = lines[0].split(",").map(h => h.trim());
  const requiredCols = ["Flight Date", "Flight Code", "Departure Airport Code", "Arrival Airport Code", "Departure Time", "Arrival Time"];
  for (const col of requiredCols) {
    if (!header.includes(col)) {
      return { imported: 0, skipped: 0, errors: [`Missing required column: ${col}`] };
    }
  }

  // Build lookup maps
  const opMap = new Map<string, string>(); // code -> name
  const ops = seedDb.select().from(operators).where(eq(operators.type, "airline")).all();
  ops.forEach(o => { if (o.code && !opMap.has(o.code.toUpperCase())) opMap.set(o.code.toUpperCase(), o.name); });

  const stationMap = new Map<string, { id: number; timezone: string | null }>(); // code -> id + tz
  const sts = seedDb.select().from(stations).all();
  sts.forEach(s => { if (s.code) stationMap.set(s.code.toUpperCase(), { id: s.id, timezone: s.timezone || null }); });

  // Check existing trips
  const existingKeys = new Set<string>();
  const allTrips = userDb.select().from(trips).all();
  allTrips.forEach(t => existingKeys.add(`${t.date}|${t.trainFlightNumber}`));

  let imported = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map(c => c.trim());
    if (cols.length < header.length) {
      errors.push(`Row ${i + 1}: insufficient columns (${cols.length} < ${header.length})`);
      continue;
    }
    const row: Record<string, string> = {};
    header.forEach((h, j) => { row[h] = cols[j] || ""; });

    const flightDate = row["Flight Date"] || "";
    const flightCode = row["Flight Code"] || "";
    const depCode = row["Departure Airport Code"] || "";
    const arrCode = row["Arrival Airport Code"] || "";
    const depTime = row["Departure Time"] || "";
    const arrTime = row["Arrival Time"] || "";

    if (!flightDate || !flightCode || !depCode || !arrCode) {
      errors.push(`Row ${i + 1}: missing required fields`);
      continue;
    }

    // Duplicate check
    const dupKey = `${flightDate}|${flightCode}`;
    if (existingKeys.has(dupKey)) {
      skipped++;
      continue;
    }

    // Operator lookup by code prefix
    const opCode = flightCode.slice(0, 2).toUpperCase();
    const operatorName = opMap.get(opCode);
    if (!operatorName) {
      errors.push(`Row ${i + 1}: operator code "${opCode}" not found in database`);
      continue;
    }

    // Station lookup by IATA code
    const depSt = stationMap.get(depCode.toUpperCase());
    const arrSt = stationMap.get(arrCode.toUpperCase());
    if (!depSt) { errors.push(`Row ${i + 1}: departure station "${depCode}" not found`); continue; }
    if (!arrSt) { errors.push(`Row ${i + 1}: arrival station "${arrCode}" not found`); continue; }
    const timezone = depSt.timezone || "Asia/Shanghai";

    // Build notes
    const notesParts: string[] = [];
    const seatType = row["Seat Type"]?.trim();
    const purpose = row["Purpose"]?.trim();
    const bookingCode = row["Booking Code"]?.trim();
    const csvNotes = row["Notes"]?.trim();
    if (seatType) notesParts.push(`偏好:${seatType}`);
    if (purpose) notesParts.push(`目的:${purpose}`);
    if (bookingCode) notesParts.push(`票号:${bookingCode}`);
    if (csvNotes) notesParts.push(csvNotes);

    // Compute duration from timezone-aware times
    const duration = computeDuration(
      flightDate, depTime, timezone,
      flightDate, arrTime, arrSt.timezone || timezone
    );

    // Compute distance from station coordinates
    const ds = seedDb.select().from(stations).where(eq(stations.id, depSt.id)).get() as any;
    const as = seedDb.select().from(stations).where(eq(stations.id, arrSt.id)).get() as any;
    const distance = computeDistance(
      ds?.latitude, ds?.longitude,
      as?.latitude, as?.longitude
    );

    try {
      userDb.insert(trips).values({
        type: "flight",
        departureDate: flightDate,
        arrivalDate: flightDate,
        departureTime: depTime,
        arrivalTime: arrTime,
        departureTimezone: timezone,
        arrivalTimezone: arrSt.timezone || timezone,
        departureStationId: depSt.id,
        arrivalStationId: arrSt.id,
        operator: operatorName,
        trainFlightNumber: flightCode,
        durationMinutes: duration ?? null,
        distanceKm: distance ?? null,
        seatNumber: row["Seat Number"]?.trim() || null,
        seatClass: row["Seat Class"]?.trim() || null,
        notes: notesParts.length > 0 ? notesParts.join(" | ") : null,
        createdAt: now,
        updatedAt: now,
      }).run();
      imported++;
    } catch (e: any) {
      errors.push(`Row ${i + 1}: ${e.message}`);
    }
  }

  saveUserDb();
  return { imported, skipped, errors };
}

// CLI entry: run with `npx tsx server/src/db/import-byair.ts <csv-file>`
const args = process.argv.slice(2);
if (args.length >= 1) {
  (async () => {
    const { initDb } = await import("./index");
    await initDb();
    const result = importByAirFlights(args[0]);
    console.log(`Imported: ${result.imported}`);
    console.log(`Skipped (duplicates): ${result.skipped}`);
    if (result.errors.length > 0) {
      console.log(`Errors: ${result.errors.length}`);
      result.errors.forEach(e => console.log(`  ${e}`));
    }
    process.exit(0);
  })();
}
