import { Router, Request, Response } from "express";
import { seedDb, saveSeedDb } from "../db/index";
import { stations, airports } from "../db/schema";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

// GET /api/stations — queries stations (trains) and airports, unioned
router.get("/", (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").toLowerCase();
    const type = req.query.type as string | undefined;

    // Build conditions for stations (trains)
    const stConditions: ReturnType<typeof sql>[] = [];
    if (q) {
      stConditions.push(sql`(
        ${stations.name} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.city} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.code} LIKE ${"%" + q + "%"} COLLATE NOCASE
      )`);
    }

    // Build conditions for airports
    const apConditions: ReturnType<typeof sql>[] = [];
    if (q) {
      apConditions.push(sql`(
        ${airports.name} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${airports.city} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${airports.code} LIKE ${"%" + q + "%"} COLLATE NOCASE
      )`);
    }

    let stQuery = seedDb.select().from(stations);
    let apQuery = seedDb.select().from(airports);

    if (stConditions.length > 0) stQuery = stQuery.where(and(...stConditions));
    if (apConditions.length > 0) apQuery = apQuery.where(and(...apConditions));

    // If type filter: only query the relevant table
    if (type === "train_station") {
      const result = stQuery.limit(20).all();
      return res.json({ success: true, data: result });
    }
    if (type === "airport") {
      const result = apQuery.limit(20).all();
      return res.json({ success: true, data: result });
    }

    // No type filter: union both, limit total
    const stResults = stQuery.limit(10).all();
    const apResults = apQuery.limit(10).all();
    res.json({ success: true, data: [...stResults, ...apResults].slice(0, 20) });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stations/:id — checks both stations and airports
router.get("/:id", (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    let result = seedDb.select().from(stations).where(eq(stations.id, id)).get();
    if (!result) result = seedDb.select().from(airports).where(eq(airports.id, id)).get();
    if (!result) { res.status(404).json({ success: false, error: "Station not found" }); return; }
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/stations
router.post("/", (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const data = req.body;
    const result = seedDb.insert(stations).values({
      name: data.name, code: data.code ?? null, city: data.city, country: data.country, timezone: data.timezone ?? null,
      latitude: data.latitude ?? null, longitude: data.longitude ?? null,
      type: data.type, createdAt: now,
    }).returning().get();
    saveSeedDb();
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
