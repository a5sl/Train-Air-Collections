import { desc, asc, eq, inArray, isNotNull } from "drizzle-orm";
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

function backupPrefix(owner: string): string {
  return BACKUP_PREFIX + owner + "/";
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Dump the given owner's trips + trip_images as a JSON backup payload. */
export async function exportUserDb(dbs: Dbs, owner: string): Promise<string> {
  const t = await dbs.user.select().from(trips)
    .where(eq(trips.owner, owner))
    .orderBy(desc(trips.departureDate), desc(trips.id)).all();
  const imgs: any[] = [];
  for (const group of chunk(t.map((x) => x.id), 90)) {
    const rows = await dbs.user.select().from(tripImages).where(inArray(tripImages.tripId, group)).orderBy(asc(tripImages.id)).all();
    imgs.push(...rows);
  }
  return JSON.stringify({
    version: 1,
    owner,
    exportedAt: new Date().toISOString(),
    trips: t,
    tripImages: imgs,
  });
}

/** Replace the owner's trips/trip_images tables with backup payload contents. */
export async function restoreFromText(dbs: Dbs, owner: string, text: string): Promise<{ tripCount: number }> {
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

  const myTrips = await dbs.user.select().from(trips).where(eq(trips.owner, owner)).all();
  for (const group of chunk(myTrips.map((x) => x.id), 90)) {
    await dbs.user.delete(tripImages).where(inArray(tripImages.tripId, group)).run();
  }
  await dbs.user.delete(trips).where(eq(trips.owner, owner)).run();

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
      isCodeshare: t.isCodeshare ? 1 : 0,
      operatingCarrier: t.operatingCarrier ?? null,
      operatingFlightNumber: t.operatingFlightNumber ?? null,
      actualDepartureTime: t.actualDepartureTime ?? null,
      actualArrivalTime: t.actualArrivalTime ?? null,
      durationMinutes: t.durationMinutes ?? null,
      distanceKm: t.distanceKm ?? null,
      cost: t.cost ?? null,
      currency: t.currency ?? null,
      seatNumber: t.seatNumber ?? null,
      seatClass: t.seatClass ?? null,
      notes: t.notes ?? null,
      owner,
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

export async function listBackups(env: Env, owner: string): Promise<BackupInfo[]> {
  const prefix = backupPrefix(owner);
  const listed = await env.R2.list({ prefix });
  return listed.objects
    .filter((o) => /^user-[\w-]+\.json$/.test(o.key.slice(prefix.length)))
    .map((o) => ({
      name: o.key.slice(prefix.length),
      size: o.size,
      modifiedAt: o.uploaded.toISOString(),
    }))
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

export async function restoreBackupByName(env: Env, dbs: Dbs, owner: string, name: string): Promise<{ tripCount: number }> {
  if (!/^user-[\w-]+\.json$/.test(name)) throw new Error("Invalid backup name");
  const obj = await env.R2.get(backupPrefix(owner) + name);
  if (!obj) throw new Error("Backup not found");
  const text = await obj.text();
  return restoreFromText(dbs, owner, text);
}

/** Write a daily auto-backup per owner to R2 and prune old copies. Never throws. */
export async function autoBackup(env: Env): Promise<void> {
  try {
    const dbs = getDbs(env);
    const ownerRows = await dbs.user
      .select({ owner: trips.owner })
      .from(trips)
      .where(isNotNull(trips.owner))
      .all();
    const owners = Array.from(new Set(ownerRows.map((r) => r.owner).filter(Boolean) as string[]));
    for (const owner of owners) {
      const tripCount = await dbs.user.$count(trips, eq(trips.owner, owner));
      if (tripCount === 0) continue;
      const payload = await exportUserDb(dbs, owner);
      const key = backupPrefix(owner) + "user-" + timestampTag() + ".json";
      await env.R2.put(key, payload, { httpMetadata: { contentType: "application/json" } });
      const prefix = backupPrefix(owner);
      const listed = await env.R2.list({ prefix });
      const olds = listed.objects
        .map((o) => o.key)
        .filter((k) => /^backups\/[^/]+\/user-\d{8}-\d{6}\.json$/.test(k) && k.startsWith(prefix))
        .sort()
        .reverse();
      for (const old of olds.slice(MAX_AUTO_BACKUPS)) {
        await env.R2.delete(old);
      }
      console.log("Auto-backup written:", key, "(" + tripCount + " trips)");
    }
  } catch (e) {
    console.warn("Auto-backup failed (non-fatal):", e);
  }
}

export { MAX_RESTORE_BASE64 };