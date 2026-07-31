/**
 * Timezone offset helpers.
 *
 * Offsets are date-aware: zones with daylight saving (e.g. America/New_York)
 * shift between UTC-5 and UTC-4 across the year, so the offset is always
 * computed for a specific date. Half-hour and 45-minute zones (Asia/Kolkata
 * UTC+5:30, Asia/Kathmandu UTC+5:45) are handled as well.
 */

/**
 * Return the UTC offset in minutes for an IANA timezone at a given date.
 * Positive = east of UTC. Returns null if the timezone is invalid.
 */
export function getTimezoneOffsetMinutes(tz: string, dateStr: string): number | null {
  try {
    const dt = new Date((dateStr || new Date().toISOString().slice(0, 10)) + "T12:00:00Z");
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      timeZoneName: "longOffset",
      hour12: false,
    }).formatToParts(dt);
    const off = parts.find(p => p.type === "timeZoneName")?.value;
    if (!off) return null;
    // "GMT" with no suffix means UTC+0
    if (off === "GMT") return 0;
    if (off.startsWith("GMT")) {
      const sign = off[3] === "-" ? -1 : 1;
      const [h, m] = off.slice(4).split(":").map(Number);
      return sign * (h * 60 + (m || 0));
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Format an offset in minutes as a compact UTC label.
 * Whole hours: "UTC+8", "UTC-5". Fractional: "UTC+5:30", "UTC+9:45".
 */
export function formatUtcOffset(minutes: number | null): string {
  if (minutes === null) return "";
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `UTC${sign}${h}` : `UTC${sign}${h}:${String(m).padStart(2, "0")}`;
}

/**
 * Convenience: IANA timezone + date -> "UTC+8" style label.
 * Returns "" when the timezone is missing or invalid.
 */
export function utcOffsetLabel(tz: string | null | undefined, dateStr: string): string {
  if (!tz) return "";
  return formatUtcOffset(getTimezoneOffsetMinutes(tz, dateStr));
}
