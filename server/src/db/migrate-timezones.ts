import { seedDb, userDb, saveUserDb } from "./index";
import { trips, stations, airports } from "./schema";
import { eq } from "drizzle-orm";
import { computeDuration } from "../geo";
import tzlookup from "tz-lookup";

/** Look up the correct timezone for a station/airport from seed.db. */
function lookupTz(stationId: number, type: "train" | "flight"): string {
  try {
    const row = type === "flight"
      ? seedDb.select().from(airports).where(eq(airports.id, stationId)).get()
      : seedDb.select().from(stations).where(eq(stations.id, stationId)).get();
    if (!row) return "Asia/Shanghai";
    if (row.timezone && row.timezone.trim() !== "") return row.timezone;
    if (row.latitude != null && row.longitude != null) {
      try { return tzlookup(row.latitude, row.longitude); } catch { /* fall through */ }
    }
  } catch { /* fall through */ }
  return "Asia/Shanghai";
}

/**
 * Idempotent startup migration: scan all trips in user.db, correct any
 * timezone that does not match the station's actual timezone, and
 * recompute durationMinutes when a correction is made.
 */
export function migrateTimezones(): void {
  const allTrips = userDb.select().from(trips).all();
  let fixed = 0;

  for (const trip of allTrips) {
    const correctDepTz = lookupTz(trip.departureStationId, trip.type as "train" | "flight");
    const correctArrTz = lookupTz(trip.arrivalStationId, trip.type as "train" | "flight");

    const depNeedsFix = trip.departureTimezone !== correctDepTz;
    const arrNeedsFix = trip.arrivalTimezone !== correctArrTz;

    if (!depNeedsFix && !arrNeedsFix) continue;

    const newDepTz = depNeedsFix ? correctDepTz : trip.departureTimezone;
    const newArrTz = arrNeedsFix ? correctArrTz : trip.arrivalTimezone;

    const update: Record<string, any> = {
      departureTimezone: newDepTz,
      arrivalTimezone: newArrTz,
    };

    // Recompute duration with corrected timezones
    const computed = computeDuration(
      trip.departureDate, trip.departureTime, newDepTz,
      trip.arrivalDate, trip.arrivalTime, newArrTz,
    );
    if (computed !== null) update.durationMinutes = computed;

    userDb.update(trips).set(update).where(eq(trips.id, trip.id)).run();
    fixed++;
  }

  if (fixed > 0) {
    saveUserDb();
    console.log(`[migrate-timezones] Fixed timezone for ${fixed} trip(s) in user.db`);
  } else {
    console.log(`[migrate-timezones] All ${allTrips.length} trips have correct timezones. No changes needed.`);
  }
}
