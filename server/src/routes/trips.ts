import { Router, Request, Response } from "express";
import { seedDb, userDb, saveUserDb } from "../db/index";
import { trips, stations } from "../db/schema";
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

const router = Router();

// GET /api/trips — returns all trips with station details
router.get("/", (_req: Request, res: Response) => {
  try {
    const allTrips = userDb.select().from(trips).orderBy(desc(trips.departureDate), desc(trips.id)).all();

    // Batch-fetch all relevant stations
    const stationIds = new Set<number>();
    allTrips.forEach(t => { stationIds.add(t.departureStationId); stationIds.add(t.arrivalStationId); });
    const ids = Array.from(stationIds);
    const stationMap = new Map<number, any>();
    if (ids.length > 0) {
      const foundStations = seedDb.select().from(stations).where(
        inArray(stations.id, ids)
      ).all();
      foundStations.forEach(s => stationMap.set(s.id, s));
    }

    const data = allTrips.map(trip => ({
      ...trip,
      departureStation: stationMap.get(trip.departureStationId) || null,
      arrivalStation: stationMap.get(trip.arrivalStationId) || null,
    }));

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

    const depStation = seedDb.select().from(stations).where(eq(stations.id, trip.departureStationId)).get();
    const arrStation = seedDb.select().from(stations).where(eq(stations.id, trip.arrivalStationId)).get();

    res.json({
      success: true,
      data: { ...trip, departureStation: depStation || null, arrivalStation: arrStation || null },
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
        const ds = seedDb.select().from(stations).where(eq(stations.id, data.departureStationId)).get() as any;
        const as = seedDb.select().from(stations).where(eq(stations.id, data.arrivalStationId)).get() as any;
        return computeDistance(ds?.latitude, ds?.longitude, as?.latitude, as?.longitude) ?? data.distanceKm ?? null;
      })(),
      cost: data.cost ?? null, currency: data.currency ?? null,
      seatNumber: data.seatNumber ?? null, seatClass: data.seatClass ?? null,
      notes: data.notes ?? null, createdAt: now, updatedAt: now,
    }).returning().get();
    saveUserDb();
    res.status(201).json({ success: true, data: result });
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
      const ds = seedDb.select().from(stations).where(eq(stations.id, depId)).get() as any;
      const as2 = seedDb.select().from(stations).where(eq(stations.id, arrId)).get() as any;
      const dist = computeDistance(ds?.latitude, ds?.longitude, as2?.latitude, as2?.longitude);
      if (dist !== null) updateData.distanceKm = dist;
    }

    const result = userDb.update(trips).set(updateData).where(eq(trips.id, id)).returning().get();
    saveUserDb();
    res.json({ success: true, data: result });
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
