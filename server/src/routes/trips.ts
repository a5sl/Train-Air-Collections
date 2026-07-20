import { Router, Request, Response } from "express";
import { db, saveDb } from "../db/index";
import { trips, stations } from "../db/schema";
import { eq, desc, sql, inArray } from "drizzle-orm";

const router = Router();

// GET /api/trips — returns all trips with station details
router.get("/", (_req: Request, res: Response) => {
  try {
    const allTrips = db.select().from(trips).orderBy(desc(trips.date), desc(trips.id)).all();

    // Batch-fetch all relevant stations
    const stationIds = new Set<number>();
    allTrips.forEach(t => { stationIds.add(t.departureStationId); stationIds.add(t.arrivalStationId); });
    const ids = Array.from(stationIds);
    const stationMap = new Map<number, any>();
    if (ids.length > 0) {
      const foundStations = db.select().from(stations).where(
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
    const trip = db.select().from(trips).where(eq(trips.id, parseInt(req.params.id))).get() as any;
    if (!trip) { res.status(404).json({ success: false, error: "Trip not found" }); return; }

    const depStation = db.select().from(stations).where(eq(stations.id, trip.departureStationId)).get();
    const arrStation = db.select().from(stations).where(eq(stations.id, trip.arrivalStationId)).get();

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
    const result = db.insert(trips).values({
      type: data.type, date: data.date, departureTime: data.departureTime,
      arrivalTime: data.arrivalTime, timezone: data.timezone,
      departureStationId: data.departureStationId, arrivalStationId: data.arrivalStationId,
      operator: data.operator, trainFlightNumber: data.trainFlightNumber,
      trainName: data.trainName ?? null, vehicleType: data.vehicleType ?? null,
      vehicleNumber: data.vehicleNumber ?? null, carriageNumber: data.carriageNumber ?? null,
      durationMinutes: data.durationMinutes ?? null, distanceKm: data.distanceKm ?? null,
      cost: data.cost ?? null, currency: data.currency ?? null,
      seatNumber: data.seatNumber ?? null, seatClass: data.seatClass ?? null,
      notes: data.notes ?? null, createdAt: now, updatedAt: now,
    }).returning().get();
    saveDb();
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// PUT /api/trips/:id
router.put("/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.select().from(trips).where(eq(trips.id, id)).get();
    if (!existing) { res.status(404).json({ success: false, error: "Trip not found" }); return; }

    const now = new Date().toISOString();
    const data = req.body;
    const updateData: Record<string, any> = { updatedAt: now };
    const fields = ["type","date","departureTime","arrivalTime","timezone","departureStationId","arrivalStationId","operator","trainFlightNumber","trainName","vehicleType","vehicleNumber","carriageNumber","durationMinutes","distanceKm","cost","currency","seatNumber","seatClass","notes"];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }

    const result = db.update(trips).set(updateData).where(eq(trips.id, id)).returning().get();
    saveDb();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// DELETE /api/trips/:id
router.delete("/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.delete(trips).where(eq(trips.id, id)).run();
    if (result.changes === 0) {
      res.status(404).json({ success: false, error: "Trip not found" });
      return;
    }
    saveDb();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
