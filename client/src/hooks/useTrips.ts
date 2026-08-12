import { useEffect, useState, useCallback } from "react";
import { api, getCachedTrips } from "../lib/api";
import type { Trip } from "../../../shared/types";

/** Load trips once, then serve from the shared module cache on later mounts. */
export function useTrips() {
  const [trips, setTrips] = useState<Trip[]>(() => getCachedTrips() ?? []);
  const [loading, setLoading] = useState(() => getCachedTrips() === null);

  useEffect(() => {
    if (getCachedTrips() !== null) return;
    let alive = true;
    api
      .getTrips()
      .then((data) => {
        if (alive) setTrips(data);
      })
      .catch((err) => {
        if (alive) console.error(err);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    return api
      .getTrips()
      .then(setTrips)
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  return { trips, setTrips, loading, reload };
}