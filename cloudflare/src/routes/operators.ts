import { Hono } from "hono";
import { getDbs } from "../db";
import { getOperators, addOperator, getOperatorByCode } from "../db/seed";
import type { AppEnv } from "../context";

const router = new Hono<AppEnv>();

// GET /api/operators
router.get("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const ops = await getOperators(db, c.req.query("q"), c.req.query("type"));
    return c.json({ success: true, data: ops });
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
    const op = await getOperatorByCode(db, c.req.param("code"));
    if (!op) return c.json({ success: false, error: "Airline code not found" }, 404);
    return c.json({ success: true, data: op });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export default router;