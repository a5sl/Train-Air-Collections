import { Router, Request, Response } from "express";
import { seedDb, saveSeedDb } from "../db/index";
import { stations } from "../db/schema";
import { eq, sql, and } from "drizzle-orm";

const router = Router();

// GET /api/stations
router.get("/", (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").toLowerCase();
    const type = req.query.type as string | undefined;

    let query = seedDb.select().from(stations);

    const conditions: ReturnType<typeof sql>[] = [];

    if (q) {
      conditions.push(sql`(
        ${stations.name} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.city} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.code} LIKE ${"%" + q + "%"} COLLATE NOCASE
      )`);
    }

    if (type && (type === "train_station" || type === "airport")) {
      conditions.push(sql`${stations.type} = ${type}`);
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    } else {
      query = query.limit(50);
    }

    const result = query.limit(20).all();
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/stations/:id
router.get("/:id", (req: Request, res: Response) => {
  try {
    const station = seedDb.select().from(stations).where(eq(stations.id, parseInt(req.params.id))).get();
    if (!station) { res.status(404).json({ success: false, error: "Station not found" }); return; }
    res.json({ success: true, data: station });
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
