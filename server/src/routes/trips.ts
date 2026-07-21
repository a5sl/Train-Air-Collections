import { Router, Request, Response } from "express";
import { seedDb, userDb, saveUserDb } from "../db/index";
import { trips, stations } from "../db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";
import { and } from "drizzle-orm";

// Compute duration in minutes from departure/arrival dates, times, and timezones.
// Falls back to simple calculation if timezone data is unavailable.
function computeDuration(
  depDate: string, depTime: string, depTz: string,
  arrDate: string, arrTime: string, arrTz: string,
): number | null {
  try {
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

    const depOff = getOffset(depTz, depDate);
    const arrOff = getOffset(arrTz, arrDate);

    const [dh, dm] = depTime.split(":").map(Number);
    const [ah, am] = arrTime.split(":").map(Number);

    // Convert local times to UTC minutes
    const depUTC = dh * 60 + dm - depOff;
    const arrUTC = ah * 60 + am - arrOff;

    // Account for date difference (in days)
    const depEpoch = new Date(depDate + "T00:00:00Z").getTime();
    const arrEpoch = new Date(arrDate + "T00:00:00Z").getTime();
    const dayDiff = (arrEpoch - depEpoch) / 86400000;

    return Math.round(arrUTC - depUTC + dayDiff * 24 * 60);
  } catch {
    return null;
  }
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
      type: data.type, departureDate: data.departureDate, arrivalDate: data.arrivalDate,
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
      distanceKm: data.distanceKm ?? null,
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
