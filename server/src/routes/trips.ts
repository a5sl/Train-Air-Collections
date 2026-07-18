import { Router, Request, Response } from "express";
import { getTrips, getTrip, createTrip, updateTrip, deleteTrip, getStation } from "../db/store";

const router = Router();

router.get("/", (_req: Request, res: Response) => {
  try {
    const trips = getTrips();
    const data = trips.map((trip) => {
      const depStation = getStation(trip.departureStationId);
      const arrStation = getStation(trip.arrivalStationId);
      return {
        ...trip,
        departureStation: depStation || null,
        arrivalStation: arrStation || null,
      };
    });
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get("/:id", (req: Request, res: Response) => {
  try {
    const trip = getTrip(parseInt(req.params.id));
    if (!trip) {
      res.status(404).json({ success: false, error: "Trip not found" });
      return;
    }
    const depStation = getStation(trip.departureStationId);
    const arrStation = getStation(trip.arrivalStationId);
    res.json({
      success: true,
      data: {
        ...trip,
        departureStation: depStation || null,
        arrivalStation: arrStation || null,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post("/", (req: Request, res: Response) => {
  try {
    const trip = createTrip(req.body);
    res.status(201).json({ success: true, data: trip });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.put("/:id", (req: Request, res: Response) => {
  try {
    const trip = updateTrip(parseInt(req.params.id), req.body);
    if (!trip) {
      res.status(404).json({ success: false, error: "Trip not found" });
      return;
    }
    res.json({ success: true, data: trip });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete("/:id", (req: Request, res: Response) => {
  try {
    const ok = deleteTrip(parseInt(req.params.id));
    if (!ok) {
      res.status(404).json({ success: false, error: "Trip not found" });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
