import { desc, asc } from "drizzle-orm";
import { trips, tripImages } from "./db/schema";
import { getDbs } from "./db";
import type { Env } from "./env";
import type { Dbs } from "./db";

const BACKUP_PREFIX = "backups/";
const MAX_AUTO_BACKUPS = 10;
const MAX_RESTORE_BASE64 = 8_000_000;

function timestampTag(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getFullYear().toString() + p(d.getMonth() + 1) + p(d.getDate()) +
    "-" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds())
  );
}

export interface BackupInfo {
  name: string;
  size: number;
  modifiedAt: string;
}

/** Dump the trips + trip_images tables as a JSON backup payload. */
export async function exportUserDb(dbs: Dbs): Promise<string> {
  const t = await dbs.user.select().from(trips).orderBy(desc(trips.departureDate), desc(trips.id)).all();
  const imgs = await dbs.user.select().from(tripImages).orderBy(asc(tripImages.id)).all();
  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    trips: t,
    tripImages: imgs,
  });
}

/** Replace the live trips/trip_images tables with backup payload contents. */
export async function restoreFromText(dbs: Dbs, text: string): Promise<{ tripCount: number }> {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Not a valid backup file");
  }
  if (!data || !Array.isArray(data.trips)) {
    throw new Error("Backup does not contain trip data");
  }
  const tripCount = data.trips.length;

  await dbs.user.delete(tripImages).run();
  await dbs.user.delete(trips).run();

  for (const t of data.trips) {
    await dbs.user.insert(trips).values({
      id: t.id ?? undefined,
      type: t.type,
      departureDate: t.departureDate,
      arrivalDate: t.arrivalDate,
      departureTime: t.departureTime,
      arrivalTime: t.arrivalTime,
      departureTimezone: t.departureTimezone,
      arrivalTimezone: t.arrivalTimezone,
      departureStationId: t.departureStationId,
      arrivalStationId: t.arrivalStationId,
      operator: t.operator,
      trainFlightNumber: t.trainFlightNumber,
      trainName: t.trainName ?? null,
      vehicleType: t.vehicleType ?? null,
      vehicleNumber: t.vehicleNumber ?? null,
      carriageNumber: t.carriageNumber ?? null,
      durationMinutes: t.durationMinutes ?? null,
      distanceKm: t.distanceKm ?? null,
      cost: t.cost ?? null,
      currency: t.currency ?? null,
      seatNumber: t.seatNumber ?? null,
      seatClass: t.seatClass ?? null,
      notes: t.notes ?? null,
      createdAt: t.createdAt ?? new Date().toISOString(),
      updatedAt: t.updatedAt ?? new Date().toISOString(),
    }).run();
  }
  for (const im of data.tripImages ?? []) {
    await dbs.user.insert(tripImages).values({
      id: im.id ?? undefined,
      tripId: im.tripId,
      filename: im.filename,
      originalName: im.originalName ?? null,
      mime: im.mime,
      size: im.size,
      sortOrder: im.sortOrder ?? 0,
      createdAt: im.createdAt ?? new Date().toISOString(),
    }).run();
  }
  return { tripCount };
}

export async function listBackups(env: Env): Promise<BackupInfo[]> {
  const listed = await env.R2.list({ prefix: BACKUP_PREFIX });
  return listed.objects
    .filter((o) => /^user-[\w-]+\.json$/.test(o.key.slice(BACKUP_PREFIX.length)))
    .map((o) => ({
      name: o.key.slice(BACKUP_PREFIX.length),
      size: o.size,
      modifiedAt: o.uploaded.toISOString(),
    }))
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function restoreBackupByName(env: Env, dbs: Dbs, name: string): Promise<{ tripCount: number }> {
  if (!/^user-[\w-]+\.json$/.test(name)) throw new Error("Invalid backup name");
  const obj = await env.R2.get(BACKUP_PREFIX + name);
  if (!obj) throw new Error("Backup not found");
  const text = await obj.text();
  return restoreFromText(dbs, text);
}

/** Write a daily auto-backup to R2 and prune old copies. Never throws. */
export async function autoBackup(env: Env): Promise<void> {
  try {
    const dbs = getDbs(env);
    const tripCount = await dbs.user.$count(trips);
    if (tripCount === 0) return; // fresh database, nothing to protect
    const payload = await exportUserDb(dbs);
    const key = BACKUP_PREFIX + "user-" + timestampTag() + ".json";
    await env.R2.put(key, payload, { httpMetadata: { contentType: "application/json" } });
    const listed = await env.R2.list({ prefix: BACKUP_PREFIX });
    const olds = listed.objects
      .map((o) => o.key)
      .filter((k) => /^backups\/user-\d{8}-\d{6}\.json$/.test(k))
      .sort()
      .reverse();
    for (const old of olds.slice(MAX_AUTO_BACKUPS)) {
      await env.R2.delete(old);
    }
    console.log("Auto-backup written:", key, "(" + tripCount + " trips)");
  } catch (e) {
    console.warn("Auto-backup failed (non-fatal):", e);
  }
}

export { MAX_RESTORE_BASE64 };