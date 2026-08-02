import { Router } from "express";
import {
  exportUserDb,
  restoreUserDbFromBuffer,
  listBackups,
  restoreBackupByName,
} from "../db/index";

const router = Router();

const MAX_RESTORE_BASE64 = 8_000_000; // ~6MB database after base64 inflation

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// GET /api/backup — download the current user.db
router.get("/", (_req, res) => {
  try {
    const buf = exportUserDb();
    res.setHeader("Content-Type", "application/vnd.sqlite3");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="train-air-backup-' + stamp() + '.db"'
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(buf);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// GET /api/backup/list — list server-side automatic backups
router.get("/list", (_req, res) => {
  try {
    res.json({ success: true, data: listBackups() });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// POST /api/backup/restore — body: { dataBase64: string }
router.post("/restore", (req, res) => {
  try {
    const b64 = (req.body as any)?.dataBase64;
    if (typeof b64 !== "string" || !b64) {
      res.status(400).json({ success: false, error: "dataBase64 is required" });
      return;
    }
    if (b64.length > MAX_RESTORE_BASE64) {
      res.status(413).json({ success: false, error: "Backup file too large" });
      return;
    }
    const result = restoreUserDbFromBuffer(Buffer.from(b64, "base64"));
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// POST /api/backup/restore/:name — restore from a server-side automatic backup
router.post("/restore/:name", (req, res) => {
  try {
    const result = restoreBackupByName(req.params.name);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

export default router;
