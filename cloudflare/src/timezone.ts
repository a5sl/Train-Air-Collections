import { stations, airports } from "./db/schema";
import { eq } from "drizzle-orm";
import tzlookup from "tz-lookup";
import type { Dbs } from "./db";

/**
 * Resolve the IANA timezone for a station/airport by its ID.
 * 1. Use the timezone column if populated.
 * 2. Fall back to coordinate-based lookup via tzlookup.
 * 3. Last resort: "Asia/Shanghai".
 */
export async function resolveStationTimezone(dbs: Dbs, stationId: number, type: "train" | "flight"): Promise<string> {
  try {
    const row = type === "flight"
      ? await dbs.seed.select().from(airports).where(eq(airports.id, stationId)).get()
      : await dbs.seed.select().from(stations).where(eq(stations.id, stationId)).get();

    if (!row) return "Asia/Shanghai";
    if (row.timezone && row.timezone.trim() !== "") return row.timezone;
    if (row.latitude != null && row.longitude != null) {
      try {
        return tzlookup(row.latitude, row.longitude);
      } catch {
        // fall through
      }
    }
  } catch {
    // DB error, fall through
  }
  return "Asia/Shanghai";
}