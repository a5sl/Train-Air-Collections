/**
 * Airline helpers shared by ticket UI components.
 */

/** Extract the IATA airline code prefix from a flight number, e.g. "NH962" -> "NH", "3U8888" -> "3U". */
export function extractIataCode(flightNumber: string | null | undefined): string | null {
  if (!flightNumber) return null;
  const match = flightNumber.trim().toUpperCase().match(/^([A-Z0-9]{1,2})\d/);
  return match ? match[1] : null;
}

/** Deterministic hue derived from an airline code, used for the monogram fallback badge. */
export function monogramColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return 'hsl(' + (hash % 360) + ' 52% 42%)';
}
