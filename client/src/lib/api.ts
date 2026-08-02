import type { Trip, TripImage, Station, ApiResponse } from "../../../shared/types";

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
      headers: { "Content-Type": "text/csv" },
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

  getOperators: (q?: string, type?: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    const qs = params.toString();
    return request<any[]>(`/operators${qs ? `?${qs}` : ""}`);
  },
  createOperator: (data: { name: string; type: string }) =>
    request<any>("/operators", { method: "POST", body: JSON.stringify(data) }),

  getOperatorByCode: (code: string) =>
    request<{ id: number; name: string; type: string }>(`/operators/by-code/${encodeURIComponent(code)}`),

  seedData: () =>
    request<{ stations: number; operators: number }>("/seed", { method: "POST" }),

  // ---- Backup & Restore ----
  downloadBackup: async (): Promise<void> => {
    const res = await fetch(`${BASE}/backup`);
    if (!res.ok) {
      let msg = "Backup download failed";
      try { const j = await res.json(); if (j?.error) msg = j.error; } catch { /* ignore */ }
      throw new Error(msg);
    }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="?([^"]+)"?/);
    const filename = m?.[1] || "train-air-backup.db";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },
  restoreBackup: (file: File): Promise<{ tripCount: number }> =>
    new Promise((resolve, reject) => {
      if (file.size > 6 * 1024 * 1024) {
        reject(new Error("备份文件过大（上限 6MB）"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.onload = async () => {
        try {
          const bytes = new Uint8Array(reader.result as ArrayBuffer);
          let binary = "";
          const chunk = 0x8000;
          for (let i = 0; i < bytes.length; i += chunk) {
            binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
          }
          const dataBase64 = btoa(binary);
          const result = await request<{ tripCount: number }>("/backup/restore", {
            method: "POST",
            body: JSON.stringify({ dataBase64 }),
          });
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsArrayBuffer(file);
    }),
  listBackups: () =>
    request<{ name: string; size: number; modifiedAt: string }[]>("/backup/list"),
  restoreBackupByName: (name: string) =>
    request<{ tripCount: number }>(`/backup/restore/${encodeURIComponent(name)}`, {
      method: "POST",
    }),

  // ---- Trip Images ----
  getImages: (tripId: number) => request<TripImage[]>(`/trips/${tripId}/images`),
  uploadImage: (tripId: number, file: File): Promise<TripImage> =>
    new Promise((resolve, reject) => {
      const EXT_MIME: Record<string, string> = {
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif",
      };
      const extMatch = file.name.match(/\.[^.]+$/);
      const mime = file.type || EXT_MIME[(extMatch?.[0] || "").toLowerCase()] || "";
      const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif"];
      if (!allowed.includes(mime)) {
        reject(new Error("仅支持 jpg/png/webp/gif 格式"));
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        reject(new Error("图片过大（上限 8MB）"));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("读取文件失败"));
      reader.onload = async () => {
        try {
          const dataUrl = reader.result as string;
          const dataBase64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
          const result = await request<TripImage>(`/trips/${tripId}/images`, {
            method: "POST",
            body: JSON.stringify({ dataBase64, mime, originalName: file.name }),
          });
          resolve(result);
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    }),
  deleteImage: (tripId: number, imageId: number) =>
    request<void>(`/trips/${tripId}/images/${imageId}`, { method: "DELETE" }),
};
