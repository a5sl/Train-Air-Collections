import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { stations, airports, operators } from "../db/schema";
import { getDbs } from "../db";
import type { AppEnv } from "../context";

const router = new Hono<AppEnv>();

// POST /api/seed — seed data lives in D1 (loaded via `npm run db:seed`);
// this endpoint reports current counts for compatibility.
router.post("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const countStations: any = await db.seed.select({ c: sql`count(*)` }).from(stations).get();
    const countAirports: any = await db.seed.select({ c: sql`count(*)` }).from(airports).get();
    const countOperators: any = await db.seed.select({ c: sql`count(*)` }).from(operators).get();
    return c.json({
      success: true,
      data: { stations: Number(countStations?.c ?? 0), airports: Number(countAirports?.c ?? 0), operators: Number(countOperators?.c ?? 0) },
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export default router;