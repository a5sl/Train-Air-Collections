// ---- Server-side response cache (Cache API) ----
// GET responses are cached per-user so repeated reads skip D1 entirely, and
// explicit invalidation keeps writes fresh. Never hit on writes.
const HOST = "tac-api-cache.local";

function key(user: string, path: string): string {
  return `https://${HOST}/${encodeURIComponent(user)}${path}`;
}

/** Read a cached JSON envelope, or null on miss / cache error. */
export async function cacheGet<T = unknown>(user: string, path: string): Promise<T | null> {
  try {
    const res = await caches.default.match(key(user, path));
    if (!res) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Store a JSON envelope for `ttlSeconds`. Best-effort; failures are ignored. */
export async function cacheSet(user: string, path: string, data: unknown, ttlSeconds = 60): Promise<void> {
  try {
    const res = new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": `public, max-age=${ttlSeconds}`,
      },
    });
    await caches.default.put(key(user, path), res);
  } catch {
    // cache is best-effort
  }
}

/** Drop specific cached envelopes (usually right after a DB write). */
export async function cacheDelete(user: string, paths: string[]): Promise<void> {
  try {
    await Promise.all(paths.map((p) => caches.default.delete(key(user, p))));
  } catch {
    // cache is best-effort
  }
}