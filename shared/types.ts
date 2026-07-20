// ---- Shared types for Train-Air Collections ----

export type TransportType = "train" | "flight";
export type StationType = "train_station" | "airport";

export interface Station {
  id: number;
  name: string;
  code: string | null;          // IATA code / station code
  city: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  type: StationType;
  createdAt: string;
}

export interface Trip {
  id: number;
  type: TransportType;
  date: string;                 // "2026-07-18"
  departureTime: string;        // "14:30"
  arrivalTime: string;          // "16:45"
  timezone: string;             // "Asia/Shanghai"
  departureStationId: number;
  arrivalStationId: number;
  operator: string;             // e.g., "中国国铁", "全日空"
  trainFlightNumber: string;    // e.g., "G123", "NH962"
  trainName: string | null;     // e.g., "和谐号"
  vehicleType: string | null;   // e.g., "CRH2A", "B787-9"
  vehicleNumber: string | null; // e.g., "CRH2A-2158"
  carriageNumber: string | null; // e.g., "2" (车厢号)
  durationMinutes: number | null;
  distanceKm: number | null;
  cost: number | null;
  currency: string | null;
  seatNumber: string | null;
  seatClass: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined fields
  departureStation?: Station;
  arrivalStation?: Station;
}

export interface TripCreateInput {
  type: TransportType;
  date: string;
  departureTime: string;
  arrivalTime: string;
  timezone: string;
  departureStationId: number;
  arrivalStationId: number;
  operator: string;
  trainFlightNumber: string;
  trainName?: string;
  vehicleType?: string;
  vehicleNumber?: string;
  carriageNumber?: string;
  durationMinutes?: number;
  distanceKm?: number;
  cost?: number;
  currency?: string;
  seatNumber?: string;
  seatClass?: string;
  notes?: string;
}

export interface StationCreateInput {
  name: string;
  code?: string;
  city: string;
  country: string;
  latitude?: number;
  longitude?: number;
  type: StationType;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
