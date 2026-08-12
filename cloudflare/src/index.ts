import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env } from "./env";
import { requireUser } from "./auth";
import tripsRouter from "./routes/trips";
import imagesRouter from "./routes/images";
import stationsRouter from "./routes/stations";
import operatorsRouter from "./routes/operators";
import backupRouter from "./routes/backup";
import seedRouter from "./routes/seed";
import { getLogo, getUpload } from "./r2";
import { autoBackup } from "./backup";
import type { AppEnv } from "./context";

const app = new Hono<AppEnv>();

// Same-origin deployment; CORS kept for local frontend dev convenience.
app.use("/api/*", cors());

// ---- Authentication: all API endpoints require a valid Cloudflare Access JWT.
// Local dev falls back to DEV_USER so the site still works under `wrangler dev`.
app.use("/api/*", requireUser);

// GET /api/me — current authenticated user (email only).
app.get("/api/me", (c) =>
  c.json({ success: true, data: { email: c.get("user").email } }),
);

app.route("/api/trips", imagesRouter);
app.route("/api/trips", tripsRouter);
app.route("/api/stations", stationsRouter);
app.route("/api/operators", operatorsRouter);
app.route("/api/backup", backupRouter);
app.route("/api/seed", seedRouter);

// ---- Airline logos (self-hosted in R2) ----
app.get("/api/airlines/logo/:code", async (c) => {
  const code = String(c.req.param("code") || "").toUpperCase().replace(/\.png$/i, "");
  if (!/^[A-Z0-9]{2,3}$/.test(code)) {
    return c.json({ success: false, error: "Invalid airline code" }, 400);
  }
  const obj = await getLogo(c.env, code);
  if (!obj) return c.json({ success: false, error: "Logo not found" }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Content-Type", "image/png");
  headers.set("Cache-Control", "public, max-age=604800, immutable");
  return new Response(obj.body, { headers });
});

// ---- Trip image uploads (stored in R2, namespaced per user) ----
app.get("/api/uploads/:filename", async (c) => {
  const user = c.get("user");
  const name = String(c.req.param("filename") || "");
  if (!/^[\w-]+\.(jpg|jpeg|png|webp|gif)$/i.test(name)) {
    return c.json({ success: false, error: "Invalid filename" }, 400);
  }
  const obj = await getUpload(c.env, user.email, name);
  if (!obj) return c.json({ success: false, error: "Image not found" }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("Cache-Control", "public, max-age=604800, immutable");
  return new Response(obj.body, { headers });
});

app.get("/api/health", (c) => c.json({ status: "ok" }));

// ---- SPA fallback: serve the built frontend from the assets binding ----
app.all("/{proxy*}", async (c) => {
  const url = new URL(c.req.url);
  if (url.pathname.startsWith("/api")) {
    return c.json({ success: false, error: "Not found" }, 404);
  }
  return c.env.ASSETS.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
  scheduled: async (_controller: ScheduledController, env: Env) => {
    await autoBackup(env);
  },
};