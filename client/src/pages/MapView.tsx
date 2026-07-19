import React, { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Train, Plane, Layers, ChevronDown, Filter } from "lucide-react";
import { api } from "../lib/api";
import type { Trip } from "../../shared/types";

// Fix default marker icons in bundler
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// Train icon -- terracotta pill with locomotive SVG
const trainIcon = L.divIcon({
  html: `<div style="
    width:32px;height:32px;
    background:#fdfaf5;
    border:2px solid #b47157;
    border-radius:8px;
    box-shadow:0 2px 10px rgba(0,0,0,0.15);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b47157" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="12" rx="2"/>
      <line x1="3" y1="15" x2="21" y2="15"/>
      <line x1="3" y1="7" x2="21" y2="7"/>
      <circle cx="8" cy="19" r="1.8" fill="#b47157"/>
      <circle cx="16" cy="19" r="1.8" fill="#b47157"/>
      <rect x="10" y="4" width="4" height="3" rx="1" fill="#b47157"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});


// Airplane icon -- terracotta pill with swept-wing SVG
const planeIcon = L.divIcon({
  html: `<div style="
    width:32px;height:32px;
    background:#fdfaf5;
    border:2px solid #ca947a;
    border-radius:8px;
    box-shadow:0 2px 10px rgba(0,0,0,0.15);
    display:flex;align-items:center;justify-content:center;
  ">
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ca947a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M22 12L3 20L8 12L3 4Z"/>
      <line x1="8" y1="12" x2="15" y2="12"/>
    </svg>
  </div>`,
  className: "",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});


// Station dot -- small terracotta circle
const stationIcon = L.divIcon({
  html: `<div style="
    width:16px;height:16px;
    background:#b47157;
    border:2px solid #fdfaf5;
    border-radius:50%;
    box-shadow:0 1px 6px rgba(180,113,87,0.35);
  "></div>`,
  className: "",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});


function MapBounds({ trips }: { trips: Trip[] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    trips.forEach((t) => {
      if (t.departureStation?.latitude && t.departureStation?.longitude) {
        coords.push([t.departureStation.latitude, t.departureStation.longitude]);
      }
      if (t.arrivalStation?.latitude && t.arrivalStation?.longitude) {
        coords.push([t.arrivalStation.latitude, t.arrivalStation.longitude]);
      }
    });
    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds.pad(0.15));
    }
  }, [trips, map]);
  return null;
}

export default function MapView() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"all" | "train" | "flight">("all");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  const displayTrips = filterMode === "all"
    ? trips
    : trips.filter((t) => t.type === filterMode);

  // Build polyline for each trip
  const polylines = displayTrips
    .filter(
      (t) =>
        t.departureStation?.latitude &&
        t.departureStation?.longitude &&
        t.arrivalStation?.latitude &&
        t.arrivalStation?.longitude
    )
    .map((t) => ({
      trip: t,
      positions: [
        [t.departureStation!.latitude!, t.departureStation!.longitude!] as [number, number],
        [t.arrivalStation!.latitude!, t.arrivalStation!.longitude!] as [number, number],
      ],
    }));

  // Unique stations for markers
  const stationSet = new Map<number, { name: string; lat: number; lng: number; type: string }>();
  displayTrips.forEach((t) => {
    if (t.departureStation?.latitude && t.departureStation?.longitude && t.departureStation.id) {
      if (!stationSet.has(t.departureStation.id)) {
        stationSet.set(t.departureStation.id, {
          name: t.departureStation.name,
          lat: t.departureStation.latitude,
          lng: t.departureStation.longitude,
          type: t.type,
        });
      }
    }
    if (t.arrivalStation?.latitude && t.arrivalStation?.longitude && t.arrivalStation.id) {
      if (!stationSet.has(t.arrivalStation.id)) {
        stationSet.set(t.arrivalStation.id, {
          name: t.arrivalStation.name,
          lat: t.arrivalStation.latitude,
          lng: t.arrivalStation.longitude,
          type: t.type,
        });
      }
    }
  });

  return (
    <div className="space-y-4 h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">行旅舆图</h2>
          <p className="text-sm text-ink-400 mt-1">
            {trips.filter((t) => t.departureStation?.latitude).length} 条可示之行旅
          </p>
        </div>
        <div className="flex items-center gap-2" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-terracotta-100 text-terracotta-700 hover:bg-terracotta-200 transition-colors"
            >
              <Filter className="w-3.5 h-3.5" />
              {filterMode === "all" ? "全部显示" : filterMode === "train" ? "仅铁轨" : "仅云路"}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? "rotate-180" : ""}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 z-[9999] mt-1 w-36 bg-white rounded-lg border border-terracotta-200 shadow-lg overflow-hidden">
                {([
                  { mode: "all" as const, label: "全部显示", desc: "所有行程" },
                  { mode: "train" as const, label: "仅铁轨", desc: "只显示火车" },
                  { mode: "flight" as const, label: "仅云路", desc: "只显示航班" },
                ]).map(({ mode, label, desc }) => (
                  <button
                    key={mode}
                    onClick={() => {
                      setFilterMode(mode);
                      
                      setDropdownOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-parchment-100 flex items-center gap-2 ${
                      filterMode === mode ? "bg-terracotta-50 text-terracotta-700 font-medium" : "text-ink-600"
                    }`}
                  >
                    {mode === "train" ? <Train className="w-3.5 h-3.5 flex-shrink-0" /> :
                     mode === "flight" ? <Plane className="w-3.5 h-3.5 flex-shrink-0" /> :
                     <Filter className="w-3.5 h-3.5 flex-shrink-0" />}
                    <div>
                      <div className="text-xs leading-tight">{label}</div>
                      <div className="text-[10px] text-ink-400 leading-tight">{desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Map */}
      {loading ? (
        <div className="flex-1 card flex items-center justify-center">
          <p className="text-ink-400">加载地图中...</p>
        </div>
      ) : (
        <div className="flex-1 card overflow-hidden">
          <MapContainer
            center={[35, 105]}
            zoom={4}
            minZoom={3}
            maxBounds={[[-85, -180], [85, 180]]}
            maxBoundsViscosity={0.5}
            className="w-full h-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              noWrap={true}
            />
            <MapBounds trips={displayTrips} />

            {/* Station markers */}
            {Array.from(stationSet.entries()).map(([id, station]) => (
              <Marker
                key={`station-${id}`}
                position={[station.lat, station.lng]}
                icon={station.type === "train" ? trainIcon : planeIcon}
              >
                <Popup>
                  <div className="text-sm">
                    <p className="font-semibold">{station.name}</p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {/* Routes */}
            {polylines.map(({ trip, positions }, i) => (
              <Polyline
                key={`route-${trip.id}-${i}`}
                positions={positions}
                pathOptions={{
                  color: trip.type === "train" ? "#b47157" : "#ca947a",
                  weight: 3,
                  opacity: 0.7,
                  dashArray: trip.type === "flight" ? "8 4" : undefined,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">
                      {trip.trainFlightNumber}
                    </p>
                    <p className="text-gray-600">
                      {trip.departureStation?.name} → {trip.arrivalStation?.name}
                    </p>
                    <p className="text-ink-400 text-xs">
                      {trip.date} | {trip.operator}
                    </p>
                    {trip.distanceKm && (
                      <p className="text-ink-400 text-xs">{trip.distanceKm} km</p>
                    )}
                  </div>
                </Popup>
              </Polyline>
            ))}
          </MapContainer>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-ink-400 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-terracotta-500 rounded" />
          <span>火车</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-terracotta-400 rounded border-dashed border-terracotta-400" style={{ borderTop: "2px dashed #12b886" }} />
          <span>航班</span>
        </div>
      </div>
    </div>
  );
}
