import { Router, Request, Response } from "express";
import { getStations, getStation, createStation } from "../db/store";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  try {
    const q = (req.query.q as string || "").toLowerCase();
    const type = req.query.type as string | undefined;
    let stations = getStations();
    if (q) {
      stations = stations.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          (s.code && s.code.toLowerCase().includes(q))
      );
    } else {
      stations = stations.slice(0, 50);
    }
    // Filter by station type if provided (train_station / airport)
    if (type && (type === "train_station" || type === "airport")) {
      stations = stations.filter((s) => s.type === type);
    }
    stations = stations.slice(0, 20);
    res.json({ success: true, data: stations });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const station = getStation(parseInt(req.params.id));
    if (!station) {
      res.status(404).json({ success: false, error: "Station not found" });
      return;
    }
    res.json({ success: true, data: station });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/", (req: Request, res: Response) => {
  try {
    const station = createStation(req.body);
    res.status(201).json({ success: true, data: station });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

export default router;
