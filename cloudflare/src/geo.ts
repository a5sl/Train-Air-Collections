// Shared geographic utility functions

/** Normalize various date formats to YYYY-MM-DD. */
function normalizeDate(raw: string): string {
  // Already ISO: 2026-07-18
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Slash format: 2025/12/8 Р│В 2025-12-08
  const m = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) return m[1] + "-" + String(parseInt(m[2])).padStart(2, "0") + "-" + String(parseInt(m[3])).padStart(2, "0");
  // as-is fallback
  return raw;
}

// Compute distance in km between two points using the Haversine formula
export function computeDistance(
  lat1: number | null, lon1: number | null,
  lat2: number | null, lon2: number | null,
): number | null {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Compute duration in minutes from departure/arrival dates, times, and timezones.
// Falls back to simple calculation if timezone data is unavailable.
export function computeDuration(
  depDate: string, depTime: string, depTz: string,
  arrDate: string, arrTime: string, arrTz: string,
): number | null {
  try {
    const ndepDate = normalizeDate(depDate);
    const narrDate = normalizeDate(arrDate);

    const getOffset = (tz: string, dateStr: string): number => {
      try {
        const dt = new Date(dateStr + "T12:00:00Z");
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: tz, timeZoneName: "longOffset", hour12: false,
        }).formatToParts(dt);
        const off = parts.find(p => p.type === "timeZoneName")?.value;
        if (off && off.startsWith("GMT")) {
          const sign = off[3] === "-" ? -1 : 1;
          const [h, m] = off.slice(4).split(":").map(Number);
          return sign * (h * 60 + (m || 0));
        }
      } catch {}
      return 0;
    };

    const depOff = getOffset(depTz, ndepDate);
    const arrOff = getOffset(arrTz, narrDate);

    const [dh, dm] = depTime.split(":").map(Number);
    const [ah, am] = arrTime.split(":").map(Number);

    // Convert local times to UTC minutes
    const depUTC = dh * 60 + dm - depOff;
    const arrUTC = ah * 60 + am - arrOff;

    // Account for date difference (in days)
    const depEpoch = new Date(ndepDate + "T00:00:00Z").getTime();
    const arrEpoch = new Date(narrDate + "T00:00:00Z").getTime();
    const dayDiff = (arrEpoch - depEpoch) / 86400000;

    const result = Math.round(arrUTC - depUTC + dayDiff * 24 * 60);

    // Guard against NaN (e.g. from invalid date parse)
    if (Number.isNaN(result)) return null;

    return result;
  } catch {
    return null;
  }
}
