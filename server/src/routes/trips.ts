import { Router, Request, Response } from "express";
import { seedDb, userDb, saveUserDb } from "../db/index";
import { trips, stations, airports } from "../db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { and } from "drizzle-orm";
import { computeDuration, computeDistance } from "../geo";

/** Normalize various date formats to YYYY-MM-DD. */
function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(parseInt(m[2])).padStart(2, "0")}-${String(parseInt(m[3])).padStart(2, "0")}`;
  return raw;
}

/** Map Drizzle row keys to the camelCase names the client expects.
 *  Drizzle ORM normally does this, but we add a defensive pass
 *  so that any version / driver edge case cannot break the frontend. */
function normalizeTrip(raw: any) {
  return {
    id: raw.id,
    type: raw.type,
    departureDate: raw.departureDate ?? raw.departure_date ?? "",
    arrivalDate: raw.arrivalDate ?? raw.arrival_date ?? "",
    departureTime: raw.departureTime ?? raw.departure_time ?? "",
    arrivalTime: raw.arrivalTime ?? raw.arrival_time ?? "",
    departureTimezone: raw.departureTimezone ?? raw.departure_timezone ?? "",
    arrivalTimezone: raw.arrivalTimezone ?? raw.arrival_timezone ?? "",
    departureStationId: raw.departureStationId ?? raw.departure_station_id ?? 0,
    arrivalStationId: raw.arrivalStationId ?? raw.arrival_station_id ?? 0,
    operator: raw.operator ?? "",
    trainFlightNumber: raw.trainFlightNumber ?? raw.train_flight_number ?? "",
    trainName: raw.trainName ?? raw.train_name ?? null,
    vehicleType: raw.vehicleType ?? raw.vehicle_type ?? null,
    vehicleNumber: raw.vehicleNumber ?? raw.vehicle_number ?? null,
    carriageNumber: raw.carriageNumber ?? raw.carriage_number ?? null,
    durationMinutes: raw.durationMinutes ?? raw.duration_minutes ?? null,
    distanceKm: raw.distanceKm ?? raw.distance_km ?? null,
    cost: raw.cost ?? null,
    currency: raw.currency ?? null,
    seatNumber: raw.seatNumber ?? raw.seat_number ?? null,
    seatClass: raw.seatClass ?? raw.seat_class ?? null,
    notes: raw.notes ?? null,
    createdAt: raw.createdAt ?? raw.created_at ?? "",
    updatedAt: raw.updatedAt ?? raw.updated_at ?? "",
  };
}

const router = Router();

// GET /api/trips — returns all trips with station details
router.get("/", (_req: Request, res: Response) => {
  try {
    const allTrips = userDb.select().from(trips).orderBy(desc(trips.departureDate), desc(trips.id)).all();

    // Batch-fetch stations and airports separately to avoid ID collisions
    const trainIds = new Set<number>();
    const flightIds = new Set<number>();
    allTrips.forEach(t => {
      if (t.type === 'flight') { flightIds.add(t.departureStationId); flightIds.add(t.arrivalStationId); }
      else { trainIds.add(t.departureStationId); trainIds.add(t.arrivalStationId); }
    });
    const stationMap = new Map<number, any>();
    const airportMap = new Map<number, any>();
    if (trainIds.size > 0) {
      seedDb.select().from(stations).where(inArray(stations.id, Array.from(trainIds))).all()
        .forEach(s => stationMap.set(s.id, s));
    }
    if (flightIds.size > 0) {
      seedDb.select().from(airports).where(inArray(airports.id, Array.from(flightIds))).all()
        .forEach(s => airportMap.set(s.id, s));
    }

    const data = allTrips.map(trip => {
      const map = trip.type === 'flight' ? airportMap : stationMap;
      return {
        ...normalizeTrip(trip),
        departureStation: map.get(trip.departureStationId) || null,
        arrivalStation: map.get(trip.arrivalStationId) || null,
      };
    });

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/trips/:id
router.get("/:id", (req: Request, res: Response) => {
  try {
    const trip = userDb.select().from(trips).where(eq(trips.id, parseInt(req.params.id))).get() as any;
    if (!trip) { res.status(404).json({ success: false, error: "Trip not found" }); return; }

    const depStation = trip.type === "flight" ? seedDb.select().from(airports).where(eq(airports.id, trip.departureStationId)).get() : seedDb.select().from(stations).where(eq(stations.id, trip.departureStationId)).get();
    const arrStation = trip.type === "flight" ? seedDb.select().from(airports).where(eq(airports.id, trip.arrivalStationId)).get() : seedDb.select().from(stations).where(eq(stations.id, trip.arrivalStationId)).get();

    res.json({
      success: true,
      data: { ...normalizeTrip(trip), departureStation: depStation || null, arrivalStation: arrStation || null },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/trips
router.post("/", (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const data = req.body;
    const result = userDb.insert(trips).values({
      type: data.type, departureDate: normalizeDate(data.departureDate), arrivalDate: normalizeDate(data.arrivalDate),
      departureTime: data.departureTime, arrivalTime: data.arrivalTime,
      departureTimezone: data.departureTimezone, arrivalTimezone: data.arrivalTimezone,
      departureStationId: data.departureStationId, arrivalStationId: data.arrivalStationId,
      operator: data.operator, trainFlightNumber: data.trainFlightNumber,
      trainName: data.trainName ?? null, vehicleType: data.vehicleType ?? null,
      vehicleNumber: data.vehicleNumber ?? null, carriageNumber: data.carriageNumber ?? null,
      durationMinutes: computeDuration(
        data.departureDate, data.departureTime, data.departureTimezone,
        data.arrivalDate, data.arrivalTime, data.arrivalTimezone
      ) ?? data.durationMinutes ?? null,
      distanceKm: (() => {
        if (data.distanceKm != null) return data.distanceKm;
       const ds = (data.type === "flight" ? seedDb.select().from(airports).where(eq(airports.id, data.departureStationId)).get() : seedDb.select().from(stations).where(eq(stations.id, data.departureStationId)).get()) as any;
       const as2_ap = (data.type === "flight" ? seedDb.select().from(airports).where(eq(airports.id, data.arrivalStationId)).get() : seedDb.select().from(stations).where(eq(stations.id, data.arrivalStationId)).get()) as any;
       return computeDistance(ds?.latitude, ds?.longitude, as2_ap?.latitude, as2_ap?.longitude) ?? data.distanceKm ?? null;
     })(),
      cost: data.cost ?? null, currency: data.currency ?? null,
      seatNumber: data.seatNumber ?? null, seatClass: data.seatClass ?? null,
      notes: data.notes ?? null, createdAt: now, updatedAt: now,
    }).returning().get();
    saveUserDb();
    res.status(201).json({ success: true, data: normalizeTrip(result) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/trips/:id
router.put("/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const existing = userDb.select().from(trips).where(eq(trips.id, id)).get();
    if (!existing) { res.status(404).json({ success: false, error: "Trip not found" }); return; }

    const now = new Date().toISOString();
    const data = req.body;
    const updateData: Record<string, any> = { updatedAt: now };
    const fields = ["type","departureDate","arrivalDate","departureTime","arrivalTime","departureTimezone","arrivalTimezone","departureStationId","arrivalStationId","operator","trainFlightNumber","trainName","vehicleType","vehicleNumber","carriageNumber","durationMinutes","distanceKm","cost","currency","seatNumber","seatClass","notes"];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }

    // Always recompute duration from the full context (server-authoritative)
    const depDate = updateData.departureDate ?? existing.departureDate;
    const arrDate = updateData.arrivalDate ?? existing.arrivalDate;
    const depTime = updateData.departureTime ?? existing.departureTime;
    const arrTime = updateData.arrivalTime ?? existing.arrivalTime;
    const depTz = updateData.departureTimezone ?? existing.departureTimezone;
    const arrTz = updateData.arrivalTimezone ?? existing.arrivalTimezone;
    const computed = computeDuration(depDate, depTime, depTz, arrDate, arrTime, arrTz);
    if (computed !== null) updateData.durationMinutes = computed;

    // Compute distance from station coordinates if not explicitly set
    if (updateData.distanceKm === undefined) {
      const depId = updateData.departureStationId ?? existing.departureStationId;
      const arrId = updateData.arrivalStationId ?? existing.arrivalStationId;
      const ds = (existing.type === "flight" ? seedDb.select().from(airports).where(eq(airports.id, depId)).get() : seedDb.select().from(stations).where(eq(stations.id, depId)).get()) as any;
      const as2 = (existing.type === "flight" ? seedDb.select().from(airports).where(eq(airports.id, arrId)).get() : seedDb.select().from(stations).where(eq(stations.id, arrId)).get()) as any;
      const dist = computeDistance(ds?.latitude, ds?.longitude, as2?.latitude, as2?.longitude);
      if (dist !== null) updateData.distanceKm = dist;
    }

    const result = userDb.update(trips).set(updateData).where(eq(trips.id, id)).returning().get();
    saveUserDb();
    res.json({ success: true, data: normalizeTrip(result) });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/trips/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = userDb.delete(trips).where(eq(trips.id, id)).run();
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: "Trip not found" });
      return;
    }
    saveUserDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
