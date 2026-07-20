import { Router, Request, Response } from "express";
import { db, saveDb } from "../db/index";
import { stations } from "../db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

// GET /api/stations
router.get("/", (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").toLowerCase();
    const type = req.query.type as string | undefined;

    let query = db.select().from(stations);

    if (q) {
      query = query.where(sql`(
        ${stations.name} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.city} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.code} LIKE ${"%" + q + "%"} COLLATE NOCASE
      )`);
    } else if (!type) {
      query = query.limit(50);
    }

    if (type && (type === "train_station" || type === "airport")) {
      query = query.where(eq(stations.type, type));
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
    const station = db.select().from(stations).where(eq(stations.id, parseInt(req.params.id))).get();
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
    const result = db.insert(stations).values({
      name: data.name, code: data.code ?? null, city: data.city, country: data.country,
      latitude: data.latitude ?? null, longitude: data.longitude ?? null,
      type: data.type, createdAt: now,
    }).returning().get();
    saveDb();
    res.status(201).json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
