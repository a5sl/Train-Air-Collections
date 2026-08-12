import { Hono } from "hono";
import { eq, and, asc, max } from "drizzle-orm";
import { tripImages, trips } from "../db/schema";
import { getDbs, type Dbs } from "../db";
import { putUpload, deleteUpload } from "../r2";
import { getUser } from "../auth";
import type { AppEnv } from "../context";

const router = new Hono<AppEnv>();

const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB per image

const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Verify the decoded bytes actually match the declared image MIME type. */
function magicMatches(mime: string, buf: Buffer): boolean {
  if (mime === "image/jpeg") {
    return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mime === "image/png") {
    return buf.length > 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a;
  }
  if (mime === "image/webp") {
    if (
      buf.length <= 16 ||
      buf.subarray(0, 4).toString("ascii") !== "RIFF" ||
      buf.subarray(8, 12).toString("ascii") !== "WEBP"
    ) {
      return false;
    }
    const fourcc = buf.subarray(12, 16).toString("ascii");
    return fourcc === "VP8 " || fourcc === "VP8L" || fourcc === "VP8X";
  }
  if (mime === "image/gif") {
    const head = buf.subarray(0, 6).toString("ascii");
    return buf.length > 6 && (head === "GIF87a" || head === "GIF89a");
  }
  return false;
}

/** Row -> client shape (shared with the trips router for joined responses). */
export function imageToApi(row: any) {
  return {
    id: row.id,
    tripId: row.tripId,
    filename: row.filename,
    originalName: row.originalName ?? null,
    mime: row.mime,
    size: row.size,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    url: "/api/uploads/" + row.filename,
  };
}

async function tripExists(dbs: Dbs, owner: string, tripId: number): Promise<boolean> {
  return !!(await dbs.user.select().from(trips).where(and(eq(trips.id, tripId), eq(trips.owner, owner))).get());
}

// GET /api/trips/:tripId/images
router.get("/:tripId/images", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const tripId = parseInt(c.req.param("tripId"));
    if (!Number.isFinite(tripId)) return c.json({ success: false, error: "Invalid trip id" }, 400);
    if (!(await tripExists(db, owner, tripId))) return c.json({ success: false, error: "Trip not found" }, 404);
    const rows = await db.user
      .select()
      .from(tripImages)
      .where(eq(tripImages.tripId, tripId))
      .orderBy(asc(tripImages.sortOrder), asc(tripImages.id))
      .all();
    return c.json({ success: true, data: rows.map(imageToApi) });
  } catch (e) {
    console.error("GET images failed:", e);
    return c.json({ success: false, error: "Failed to load images" }, 500);
  }
});

// POST /api/trips/:tripId/images — body: { dataBase64, mime, originalName }
router.post("/:tripId/images", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const tripId = parseInt(c.req.param("tripId"));
    if (!Number.isFinite(tripId) || !(await tripExists(db, owner, tripId))) {
      return c.json({ success: false, error: "Trip not found" }, 404);
    }
    const body = await c.req.json();
    const { dataBase64, mime, originalName } = (body ?? {}) as any;
    if (typeof dataBase64 !== "string" || !dataBase64) {
      return c.json({ success: false, error: "dataBase64 is required" }, 400);
    }
    if (typeof mime !== "string" || !MIME_EXT[mime]) {
      return c.json({ success: false, error: "Unsupported image type (jpeg/png/webp/gif only)" }, 400);
    }
    if (dataBase64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 1024) {
      return c.json({ success: false, error: "Image too large (max 8MB)" }, 413);
    }
    const buf = Buffer.from(dataBase64, "base64");
    if (buf.length === 0) return c.json({ success: false, error: "Empty file" }, 400);
    if (buf.length > MAX_IMAGE_BYTES) return c.json({ success: false, error: "Image too large (max 8MB)" }, 413);
    if (!magicMatches(mime, buf)) {
      return c.json({ success: false, error: "File content does not match declared image type" }, 400);
    }
    const filename = tripId + "-" + crypto.randomUUID() + "." + MIME_EXT[mime];
    await putUpload(c.env, owner, filename, buf, mime);
    let row: any;
    try {
      const maxRow: any = await db.user
        .select({ m: max(tripImages.sortOrder) })
        .from(tripImages)
        .where(eq(tripImages.tripId, tripId))
        .get();
      const nextOrder = (maxRow?.m ?? -1) + 1;
      row = await db.user
        .insert(tripImages)
        .values({
          tripId,
          filename,
          originalName: typeof originalName === "string" ? originalName.trim().slice(0, 255) || null : null,
          mime,
          size: buf.length,
          sortOrder: nextOrder,
        })
        .returning()
        .get();
    } catch (dbErr) {
      try { await deleteUpload(c.env, owner, filename); } catch { /* ignore */ }
      throw dbErr;
    }
    return c.json({ success: true, data: imageToApi(row) }, 201);
  } catch (e) {
    console.error("Image upload failed:", e);
    return c.json({ success: false, error: "Image upload failed" }, 400);
  }
});

// DELETE /api/trips/:tripId/images/:imageId
router.delete("/:tripId/images/:imageId", async (c) => {
  try {
    const db = getDbs(c.env);
    const owner = getUser(c).email;
    const tripId = parseInt(c.req.param("tripId"));
    const imageId = parseInt(c.req.param("imageId"));
    if (!(await tripExists(db, owner, tripId))) return c.json({ success: false, error: "Trip not found" }, 404);
    const row: any = await db.user
      .select()
      .from(tripImages)
      .where(and(eq(tripImages.id, imageId), eq(tripImages.tripId, tripId)))
      .get();
    if (!row) return c.json({ success: false, error: "Image not found" }, 404);
    await db.user.delete(tripImages).where(eq(tripImages.id, imageId)).run();
    try {
      await deleteUpload(c.env, owner, row.filename);
    } catch {
      // file may already be gone; metadata removal is the source of truth
    }
    return c.json({ success: true });
  } catch (e) {
    console.error("DELETE image failed:", e);
    return c.json({ success: false, error: "Failed to delete image" }, 500);
  }
});

export default router;