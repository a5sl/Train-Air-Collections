import { Hono } from "hono";
import { getDbs } from "../db";
import { cacheGet, cacheSet } from "../cache";
import { getOperators, addOperator, getOperatorByCode } from "../db/seed";
import { getUser } from "../auth";
import type { AppEnv } from "../context";

const router = new Hono<AppEnv>();

// GET /api/operators
router.get("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const rawSearch = new URL(c.req.url).search;
    const path = "/api/operators" + rawSearch;

    const cached = await cacheGet(owner, path);
    if (cached) return c.json(cached);

    const ops = await getOperators(db, c.req.query("q"), c.req.query("type"));
    const payload = { success: true, data: ops };
    await cacheSet(owner, path, payload, 60);
    return c.json(payload);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/operators
router.post("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const op = await addOperator(db, await c.req.json());
    return c.json({ success: true, data: op }, 201);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400);
  }
});

// GET /api/operators/by-code/:code — exact IATA code lookup
router.get("/by-code/:code", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const code = c.req.param("code");
    const path = `/api/operators/by-code/${encodeURIComponent(code)}`;

    const cached = await cacheGet(owner, path);
    if (cached) return c.json(cached);

    const op = await getOperatorByCode(db, code);
    if (!op) return c.json({ success: false, error: "Airline code not found" }, 404);
    const payload = { success: true, data: op };
    await cacheSet(owner, path, payload, 300);
    return c.json(payload);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export default router;