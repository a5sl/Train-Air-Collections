import type { Trip } from '../../../shared/types';

export interface CatalogVariant {
  label: string;
  count: number;
}

export interface CatalogOperator {
  name: string; // 实际承运人（代码共享取 operatingCarrier，否则为 operator）
  flightNumber: string; // 用于提取航司 IATA 的航班号（优先 operatingFlightNumber）
  count: number;
  marketing: string[]; // 缔约承运人清单（代码共享时记录 operator）
}

export interface CatalogEntry {
  key: string;
  label: string;
  type: 'train' | 'flight';
  count: number;
  totalKm: number;
  totalMinutes: number;
  firstDate: string;
  lastDate: string;
  operators: CatalogOperator[];
  variants: CatalogVariant[];
  trips: Trip[];
}

/** 机型族系归一化：B737-800 / B737-8 / B737-700 → B737；A320-232 / A321Neo → A321 */
export function normalizeFlightFamily(vehicleType: string): string {
  const t = vehicleType.trim();
  const m = t.match(/^([A-Z]{1,3})-?(\d{3})/i);
  return m ? (m[1] + m[2]).toUpperCase() : t;
}

/** 车型族系归一化：CR400AF-B → CR400AF；CRH380A重联型 → CRH380A */
export function normalizeTrainFamily(vehicleType: string): string {
  const t = vehicleType.trim();
  const m = t.match(/CR[A-Z]+\d+[A-Z]*/i);
  return m ? m[0].toUpperCase() : t;
}

function buildEntries(
  trips: Trip[],
  vtOf: (t: Trip) => string | null,
  familyOf: (vt: string) => string,
  keyOf: (t: Trip, vt: string) => string | null = () => null,
  labelOf: (t: Trip, family: string) => string = (_t, family) => family
): CatalogEntry[] {
  const groups = new Map<string, CatalogEntry>();
  for (const trip of trips) {
    const vt = vtOf(trip);
    if (!vt) continue;
    const family = familyOf(vt);
    const key = keyOf(trip, vt) ?? family;
    if (!key) continue;

    let e = groups.get(key);
    if (!e) {
      e = {
        key,
        label: labelOf(trip, family),
        type: trip.type,
        count: 0,
        totalKm: 0,
        totalMinutes: 0,
        firstDate: trip.departureDate,
        lastDate: trip.departureDate,
        operators: [],
        variants: [],
        trips: [],
      };
      groups.set(key, e);
    }

    e.count++;
    e.totalKm += trip.distanceKm || 0;
    e.totalMinutes += trip.durationMinutes || 0;
    if (trip.departureDate < e.firstDate) e.firstDate = trip.departureDate;
    if (trip.departureDate > e.lastDate) e.lastDate = trip.departureDate;

    const codeshare = trip.isCodeshare && !!trip.operatingCarrier;
    const effName = codeshare ? trip.operatingCarrier! : trip.operator;
    const effFlight = codeshare && trip.operatingFlightNumber ? trip.operatingFlightNumber : trip.trainFlightNumber;
    let op = e.operators.find((o) => o.name === effName);
    if (!op) {
      op = { name: effName, flightNumber: effFlight, count: 0, marketing: [] };
      e.operators.push(op);
    }
    op.count++;
    if (codeshare && !op.marketing.includes(trip.operator)) op.marketing.push(trip.operator);

    const v = e.variants.find((x) => x.label === vt);
    if (v) v.count++;
    else e.variants.push({ label: vt, count: 1 });

    e.trips.push(trip);
  }

  return Array.from(groups.values())
    .map((e) => ({
      ...e,
      operators: e.operators.sort((a, b) => b.count - a.count),
      variants: e.variants.sort((a, b) => b.count - a.count),
      trips: e.trips.sort((a, b) => b.departureDate.localeCompare(a.departureDate) || b.id - a.id),
    }))
    .sort((a, b) => b.count - a.count || a.firstDate.localeCompare(b.firstDate));
}

export interface CatalogData {
  flights: CatalogEntry[];
  trains: CatalogEntry[];
  registrations: CatalogEntry[];
}

export function buildCatalog(trips: Trip[]): CatalogData {
  return {
    flights: buildEntries(
      trips.filter((t) => t.type === 'flight'),
      (t) => t.vehicleType,
      normalizeFlightFamily
    ),
    trains: buildEntries(
      trips.filter((t) => t.type === 'train'),
      (t) => t.vehicleType,
      normalizeTrainFamily
    ),
    registrations: buildEntries(
      trips.filter((t) => t.vehicleNumber && t.vehicleNumber.trim()),
      (t) => t.vehicleNumber!.trim().toUpperCase(),
      (vt) => vt,
      (t, vt) => vt
    ),
  };
}