import express from "express";
import cors from "cors";
import { initDb } from "./db/index";
import tripsRouter from "./routes/trips";
import stationsRouter from "./routes/stations";
import { seedStations, seedOperatorsData, getOperators, addOperator, importTripsFromCSV } from "./db/seed";

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
    const ops = getOperators(req.query.q as string | undefined);
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

// ---- Seed (manual trigger) ----
app.post("/api/seed", (_req, res) => {
  try {
    const nStations = seedStations();
    const nOperators = seedOperatorsData();
    res.json({ success: true, data: { stations: nStations, operators: nOperators } });
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

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Start server
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

start();
