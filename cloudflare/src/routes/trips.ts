import { Hono } from "hono";
import { eq, desc, inArray, asc, and, count } from "drizzle-orm";
import { trips, stations, airports, tripImages } from "../db/schema";
import { getDbs } from "../db";
import { cacheGet, cacheSet, cacheDelete } from "../cache";
import { imageToApi } from "./images";
import { computeDuration, computeDistance } from "../geo";
import { resolveStationTimezone } from "../timezone";
import { importTripsFromCSV } from "../db/seed";
import { deleteUpload } from "../r2";
import { getUser } from "../auth";
import type { AppEnv } from "../context";

/** Normalize various date formats to YYYY-MM-DD. */
function normalizeDate(raw: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/);
  if (m) return `${m[1]}-${String(parseInt(m[2])).padStart(2, "0")}-${String(parseInt(m[3])).padStart(2, "0")}`;
  return raw;
}

/** Map Drizzle row keys to the camelCase names the client expects. */
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

/** Split an array into fixed-size chunks (D1 caps SQL variables per query). */
function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const router = new Hono<AppEnv>();

// GET /api/trips — returns all trips for the current user with station details
router.get("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;

    const cached = await cacheGet<{ success: true; data: unknown[] }>(owner, "/api/trips");
    if (cached) return c.json(cached);

    const allTrips = await db.user.select().from(trips)
      .where(eq(trips.owner, owner))
      .orderBy(desc(trips.departureDate), desc(trips.id)).all();

    const trainIds = new Set<number>();
    const flightIds = new Set<number>();
    allTrips.forEach((t) => {
      if (t.type === 'flight') { flightIds.add(t.departureStationId); flightIds.add(t.arrivalStationId); }
      else { trainIds.add(t.departureStationId); trainIds.add(t.arrivalStationId); }
    });
    const stationMap = new Map<number, any>();
    const airportMap = new Map<number, any>();
    for (const group of chunk(Array.from(trainIds), 90)) {
      (await db.seed.select().from(stations).where(inArray(stations.id, group)).all())
        .forEach((s) => stationMap.set(s.id, s));
    }
    for (const group of chunk(Array.from(flightIds), 90)) {
      (await db.seed.select().from(airports).where(inArray(airports.id, group)).all())
        .forEach((s) => airportMap.set(s.id, s));
    }

    // Only ship per-trip image counts in the list payload; full images load
    // lazily via GET /trips/:tripId/images or /trips/photos.
    const imageCounts = new Map<number, number>();
    if (allTrips.length > 0) {
      for (const group of chunk(allTrips.map((t) => t.id), 90)) {
        const rows = await db.user.select({ tripId: tripImages.tripId, c: count() })
          .from(tripImages)
          .where(inArray(tripImages.tripId, group))
          .groupBy(tripImages.tripId)
          .all();
        for (const row of rows) imageCounts.set(row.tripId, row.c);
      }
    }

    const data = allTrips.map((trip) => {
      const map = trip.type === 'flight' ? airportMap : stationMap;
      return {
        ...normalizeTrip(trip),
        departureStation: map.get(trip.departureStationId) || null,
        arrivalStation: map.get(trip.arrivalStationId) || null,
        imageCount: imageCounts.get(trip.id) ?? 0,
      };
    });

    const payload = { success: true, data };
    await cacheSet(owner, "/api/trips", payload, 60);
    return c.json(payload);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/trips/:id
router.get("/:id", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const id = parseInt(c.req.param("id"));

    const cached = await cacheGet<{ success: true; data: unknown }>(owner, `/api/trips/${id}`);
    if (cached) return c.json(cached);

    const trip = await db.user.select().from(trips)
      .where(and(eq(trips.id, id), eq(trips.owner, owner))).get() as any;
    if (!trip) return c.json({ success: false, error: "Trip not found" }, 404);

    const depStation = trip.type === "flight" ? await db.seed.select().from(airports).where(eq(airports.id, trip.departureStationId)).get() : await db.seed.select().from(stations).where(eq(stations.id, trip.departureStationId)).get();
    const arrStation = trip.type === "flight" ? await db.seed.select().from(airports).where(eq(airports.id, trip.arrivalStationId)).get() : await db.seed.select().from(stations).where(eq(stations.id, trip.arrivalStationId)).get();

    const tripImagesList = await db.user.select().from(tripImages)
      .where(eq(tripImages.tripId, trip.id))
      .orderBy(asc(tripImages.sortOrder), asc(tripImages.id)).all();

    const payload = {
      success: true,
      data: { ...normalizeTrip(trip), departureStation: depStation || null, arrivalStation: arrStation || null, images: tripImagesList.map(imageToApi), imageCount: tripImagesList.length },
    };
    await cacheSet(owner, `/api/trips/${id}`, payload, 60);
    return c.json(payload);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/trips
router.post("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const data = await c.req.json();
    const owner = getUser(c).email;

    const depTz = data.departureTimezone?.trim() || (await resolveStationTimezone(db, data.departureStationId, data.type));
    const arrTz = data.arrivalTimezone?.trim() || (await resolveStationTimezone(db, data.arrivalStationId, data.type));

    let distanceKm = data.distanceKm ?? null;
    if (distanceKm == null) {
      const ds = (data.type === "flight" ? await db.seed.select().from(airports).where(eq(airports.id, data.departureStationId)).get() : await db.seed.select().from(stations).where(eq(stations.id, data.departureStationId)).get()) as any;
      const as2 = (data.type === "flight" ? await db.seed.select().from(airports).where(eq(airports.id, data.arrivalStationId)).get() : await db.seed.select().from(stations).where(eq(stations.id, data.arrivalStationId)).get()) as any;
      const dist = computeDistance(ds?.latitude, ds?.longitude, as2?.latitude, as2?.longitude);
      if (dist !== null) distanceKm = dist;
    }

    const result = await db.user.insert(trips).values({
      type: data.type, departureDate: normalizeDate(data.departureDate), arrivalDate: normalizeDate(data.arrivalDate),
      departureTime: data.departureTime, arrivalTime: data.arrivalTime,
      departureTimezone: depTz, arrivalTimezone: arrTz,
      departureStationId: data.departureStationId, arrivalStationId: data.arrivalStationId,
      operator: data.operator, trainFlightNumber: data.trainFlightNumber,
      trainName: data.trainName ?? null, vehicleType: data.vehicleType ?? null,
      vehicleNumber: data.vehicleNumber ?? null, carriageNumber: data.carriageNumber ?? null,
      durationMinutes: computeDuration(
        data.departureDate, data.departureTime, depTz,
        data.arrivalDate, data.arrivalTime, arrTz
      ) ?? data.durationMinutes ?? null,
      distanceKm,
      cost: data.cost ?? null, currency: data.currency ?? null,
      seatNumber: data.seatNumber ?? null, seatClass: data.seatClass ?? null,
      notes: data.notes ?? null, owner, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }).returning().get();
    await cacheDelete(owner, ["/api/trips"]);
    return c.json({ success: true, data: normalizeTrip(result) }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// PUT /api/trips/:id
router.put("/:id", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const id = parseInt(c.req.param("id"));
    const existing = await db.user.select().from(trips).where(and(eq(trips.id, id), eq(trips.owner, owner))).get();
    if (!existing) return c.json({ success: false, error: "Trip not found" }, 404);

    const now = new Date().toISOString();
    const data = await c.req.json();
    const updateData: Record<string, any> = { updatedAt: now };
    const fields = ["type","departureDate","arrivalDate","departureTime","arrivalTime","departureTimezone","arrivalTimezone","departureStationId","arrivalStationId","operator","trainFlightNumber","trainName","vehicleType","vehicleNumber","carriageNumber","durationMinutes","distanceKm","cost","currency","seatNumber","seatClass","notes"];
    for (const f of fields) {
      if (data[f] !== undefined) updateData[f] = data[f];
    }

    const depDate = updateData.departureDate ?? existing.departureDate;
    const arrDate = updateData.arrivalDate ?? existing.arrivalDate;
    const depTime = updateData.departureTime ?? existing.departureTime;
    const arrTime = updateData.arrivalTime ?? existing.arrivalTime;
    const depTz = updateData.departureTimezone ?? existing.departureTimezone;
    const arrTz = updateData.arrivalTimezone ?? existing.arrivalTimezone;

    const finalDepTz = depTz?.trim() || (await resolveStationTimezone(db, updateData.departureStationId ?? existing.departureStationId, existing.type as "train" | "flight"));
    const finalArrTz = arrTz?.trim() || (await resolveStationTimezone(db, updateData.arrivalStationId ?? existing.arrivalStationId, existing.type as "train" | "flight"));
    updateData.departureTimezone = finalDepTz;
    updateData.arrivalTimezone = finalArrTz;

    const computed = computeDuration(depDate, depTime, finalDepTz, arrDate, arrTime, finalArrTz);
    if (computed !== null) updateData.durationMinutes = computed;

    if (updateData.distanceKm === undefined) {
      const depId = updateData.departureStationId ?? existing.departureStationId;
      const arrId = updateData.arrivalStationId ?? existing.arrivalStationId;
      const ds = (existing.type === "flight" ? await db.seed.select().from(airports).where(eq(airports.id, depId)).get() : await db.seed.select().from(stations).where(eq(stations.id, depId)).get()) as any;
      const as2 = (existing.type === "flight" ? await db.seed.select().from(airports).where(eq(airports.id, arrId)).get() : await db.seed.select().from(stations).where(eq(stations.id, arrId)).get()) as any;
      const dist = computeDistance(ds?.latitude, ds?.longitude, as2?.latitude, as2?.longitude);
      if (dist !== null) updateData.distanceKm = dist;
    }

    const result = await db.user.update(trips).set(updateData)
      .where(and(eq(trips.id, id), eq(trips.owner, owner))).returning().get();
    await cacheDelete(owner, ["/api/trips", `/api/trips/${id}`]);
    return c.json({ success: true, data: normalizeTrip(result) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

// DELETE /api/trips/:id
router.delete("/:id", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const id = parseInt(c.req.param("id"));
    const existing = await db.user.select().from(trips).where(and(eq(trips.id, id), eq(trips.owner, owner))).get();
    if (!existing) return c.json({ success: false, error: "Trip not found" }, 404);
    const imgs = await db.user.select().from(tripImages).where(eq(tripImages.tripId, id)).all() as any[];
    await db.user.delete(trips).where(and(eq(trips.id, id), eq(trips.owner, owner))).run();
    if (imgs.length > 0) {
      await db.user.delete(tripImages).where(eq(tripImages.tripId, id)).run();
    }
    for (const img of imgs) {
      try { await deleteUpload(c.env, owner, img.filename); } catch { /* ignore */ }
    }
    await cacheDelete(owner, ["/api/trips", `/api/trips/${id}`]);
    return c.json({ success: true });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/trips/import-csv — regular CSV import (byAir dropped)
router.post("/import-csv", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const csvText = await c.req.text();
    if (!csvText) return c.json({ success: false, error: "No CSV data provided" }, 400);
    const result = await importTripsFromCSV(db, csvText, owner);
    await cacheDelete(owner, ["/api/trips"]);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

export default router;