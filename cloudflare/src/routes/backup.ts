import { Hono } from "hono";
import { getDbs } from "../db";
import {
  exportUserDb,
  restoreFromText,
  listBackups,
  restoreBackupByName,
  MAX_RESTORE_BASE64,
} from "../backup";
import { getUser } from "../auth";
import type { AppEnv } from "../context";

const router = new Hono<AppEnv>();

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// GET /api/backup — download the current user's data (JSON backup)
router.get("/", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const payload = await exportUserDb(db, owner);
    return new Response(payload, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": 'attachment; filename="train-air-backup-' + stamp() + '.json"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/backup/list — list the current user's server-side automatic backups
router.get("/list", async (c) => {
  try {
    const owner = getUser(c).email;
    return c.json({ success: true, data: await listBackups(c.env, owner) });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/backup/restore — body: { dataBase64: string }
router.post("/restore", async (c) => {
  try {
    const b64 = (await c.req.json())?.dataBase64;
    if (typeof b64 !== "string" || !b64) {
      return c.json({ success: false, error: "dataBase64 is required" }, 400);
    }
    if (b64.length > MAX_RESTORE_BASE64) {
      return c.json({ success: false, error: "Backup file too large" }, 413);
    }
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const text = Buffer.from(b64, "base64").toString("utf8");
    const result = await restoreFromText(db, owner, text);
    return c.json({ success: true, data: result });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400);
  }
});

// POST /api/backup/restore/:name — restore from the current user's auto backup
router.post("/restore/:name", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const result = await restoreBackupByName(c.env, db, owner, c.req.param("name"));
    return c.json({ success: true, data: result });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 400);
  }
});

export default router;