import { seedDb } from "./db/index";
import { stations, airports } from "./db/schema";
import { eq } from "drizzle-orm";
import tzlookup from "tz-lookup";

/**
 * Resolve the IANA timezone for a station/airport by its ID.
 * 1. Use the timezone column if populated.
 * 2. Fall back to coordinate-based lookup via tzlookup.
 * 3. Last resort: "Asia/Shanghai".
 */
export function resolveStationTimezone(stationId: number, type: "train" | "flight"): string {
  try {
    const row = type === "flight"
      ? seedDb.select().from(airports).where(eq(airports.id, stationId)).get()
      : seedDb.select().from(stations).where(eq(stations.id, stationId)).get();

    if (!row) return "Asia/Shanghai";

    // Prefer the stored timezone
    if (row.timezone && row.timezone.trim() !== "") return row.timezone;

    // Coordinate-based fallback
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
