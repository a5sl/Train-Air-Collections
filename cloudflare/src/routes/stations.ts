import { Hono } from "hono";
import { eq, sql, and } from "drizzle-orm";
import { stations, airports } from "../db/schema";
import { getDbs } from "../db";
import type { AppEnv } from "../context";

const router = new Hono<AppEnv>();

// GET /api/stations — queries stations (trains) and airports, unioned
router.get("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const q = (c.req.query("q") || "").toLowerCase();
    const type = c.req.query("type");

    const stConditions: ReturnType<typeof sql>[] = [];
    if (q) {
      stConditions.push(sql`(
        ${stations.name} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.city} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${stations.code} LIKE ${"%" + q + "%"} COLLATE NOCASE
      )`);
    }
    const apConditions: ReturnType<typeof sql>[] = [];
    if (q) {
      apConditions.push(sql`(
        ${airports.name} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${airports.city} LIKE ${"%" + q + "%"} COLLATE NOCASE
        OR ${airports.code} LIKE ${"%" + q + "%"} COLLATE NOCASE
      )`);
    }

    let stQuery: any = db.seed.select().from(stations);
    let apQuery: any = db.seed.select().from(airports);
    if (stConditions.length > 0) stQuery = stQuery.where(and(...stConditions));
    if (apConditions.length > 0) apQuery = apQuery.where(and(...apConditions));

    if (type === "train_station") {
      return c.json({ success: true, data: await stQuery.limit(20).all() });
    }
    if (type === "airport") {
      return c.json({ success: true, data: await apQuery.limit(20).all() });
    }
    const stResults = await stQuery.limit(10).all();
    const apResults = await apQuery.limit(10).all();
    return c.json({ success: true, data: [...stResults, ...apResults].slice(0, 20) });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// GET /api/stations/:id — checks both stations and airports
router.get("/:id", async (c) => {
  try {
    const db = getDbs(c.env);
    const id = parseInt(c.req.param("id"));
    let result = await db.seed.select().from(stations).where(eq(stations.id, id)).get();
    if (!result) result = await db.seed.select().from(airports).where(eq(airports.id, id)).get();
    if (!result) return c.json({ success: false, error: "Station not found" }, 404);
    return c.json({ success: true, data: result });
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 500);
  }
});

// POST /api/stations
router.post("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const data = await c.req.json();
    const result = await db.seed.insert(stations).values({
      name: data.name, code: data.code ?? null, city: data.city, country: data.country, timezone: data.timezone ?? null,
      latitude: data.latitude ?? null, longitude: data.longitude ?? null,
      type: data.type, createdAt: new Date().toISOString(),
    }).returning().get();
    return c.json({ success: true, data: result }, 201);
  } catch (err: any) {
    return c.json({ success: false, error: err.message }, 400);
  }
});

export default router;