import { useState, useCallback, useRef } from "react";
import { api } from "../lib/api";
import type { Station } from "../../shared/types";

export function useStationSearch() {
  const [results, setResults] = useState<Station[]>([]);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback((q: string, type?: "train_station" | "airport") => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q || q.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.getStations(q, type);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 200);
  }, []);

  return { results, loading, search };
}
