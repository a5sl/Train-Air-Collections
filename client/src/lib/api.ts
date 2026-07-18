import type { Trip, Station, ApiResponse } from "../../shared/types";

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const json: ApiResponse<T> = await res.json();
  if (!json.success) throw new Error(json.error || "Request failed");
  return json.data as T;
}

export const api = {
  getTrips: () => request<Trip[]>("/trips"),
  getTrip: (id: number) => request<Trip>(`/trips/${id}`),
  createTrip: (data: Partial<Trip>) =>
    request<Trip>("/trips", { method: "POST", body: JSON.stringify(data) }),
  updateTrip: (id: number, data: Partial<Trip>) =>
    request<Trip>(`/trips/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTrip: (id: number) =>
    request<void>(`/trips/${id}`, { method: "DELETE" }),
  importTripsCSV: (csv: string) =>
    request<{ imported: number; errors: string[] }>("/trips/import-csv", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: csv,
    }),

  getStations: (q?: string, type?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    const qs = params.toString();
    return request<Station[]>(`/stations${qs ? `?${qs}` : ""}`);
  },
  getStation: (id: number) => request<Station>(`/stations/${id}`),
  createStation: (data: Partial<Station>) =>
    request<Station>("/stations", { method: "POST", body: JSON.stringify(data) }),

  getOperators: (q?: string) =>
    request<any[]>(`/operators${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createOperator: (data: { name: string; type: string; region: string }) =>
    request<any>("/operators", { method: "POST", body: JSON.stringify(data) }),

  seedData: () =>
    request<{ stations: number; operators: number }>("/seed", { method: "POST" }),
};
