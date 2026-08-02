import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { initDb } from "./db/index";
import tripsRouter from "./routes/trips";
import stationsRouter from "./routes/stations";
import { seedStations, seedAirports, seedOperatorsData, getOperators, addOperator, importTripsFromCSV, populateIataCodes, getOperatorByCode } from "./db/seed";
import { importByAirFlights } from "./db/import-byair";
import { migrateTimezones } from "./db/migrate-timezones";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ limit: "10mb", type: "text/csv" }));

app.use("/api/trips", tripsRouter);
app.use("/api/stations", stationsRouter);

// ---- Operators ----
app.get("/api/operators", (req, res) => {
  try {
    const ops = getOperators(req.query.q as string | undefined, req.query.type as string | undefined);
    res.json({ success: true, data: ops });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

app.post("/api/operators", (req, res) => {
  try {
    const op = addOperator(req.body);
    res.status(201).json({ success: true, data: op });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// GET /api/operators/by-code/:code — exact IATA code lookup
app.get("/api/operators/by-code/:code", (req, res) => {
  try {
    const op = getOperatorByCode(req.params.code);
    if (!op) {
      res.status(404).json({ success: false, error: "Airline code not found" });
      return;
    }
    res.json({ success: true, data: op });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---- Airline logos (self-hosted static files) ----
const AIRLINE_LOGO_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "airline-logos");

app.get("/api/airlines/logo/:code", (req, res) => {
  const code = String(req.params.code || "").toUpperCase().replace(/\.png$/i, "");
  if (!/^[A-Z0-9]{2,3}$/.test(code)) {
    res.status(400).json({ success: false, error: "Invalid airline code" });
    return;
  }
  const file = path.join(AIRLINE_LOGO_DIR, code + ".png");
  if (!fs.existsSync(file)) {
    res.status(404).json({ success: false, error: "Logo not found" });
    return;
  }
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "public, max-age=604800, immutable");
  res.sendFile(file);
});

// ---- Seed (manual trigger) ----
app.post("/api/seed", (_req, res) => {
  try {
    const nStations = seedStations();
    const nAirports = seedAirports();
    const nOperators = seedOperatorsData();
    res.json({ success: true, data: { stations: nStations, airports: nAirports, operators: nOperators } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ---- CSV Import ----
app.post("/api/trips/import-csv", (req, res) => {
  try {
    const csvText = typeof req.body === "string" ? req.body : (req.body as any).csv || "";
    if (!csvText) {
      res.status(400).json({ success: false, error: "No CSV data provided" });
      return;
    }
    const result = importTripsFromCSV(csvText);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

// ---- byAir CSV Import ----
app.post("/api/trips/import-byair", (req, res) => {
  try {
    const csvPath = req.body?.csvPath;
    if (!csvPath) {
      res.status(400).json({ success: false, error: "csvPath is required" });
      return;
    }
    const result = importByAirFlights(csvPath);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(400).json({ success: false, error: e.message });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Start server
async function start() {
  await initDb();
  migrateTimezones();
  populateIataCodes();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
