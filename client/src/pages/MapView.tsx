import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Train, Plane, Layers } from "lucide-react";
import { api } from "../lib/api";
import type { Trip } from "../../shared/types";

// Fix default marker icons in bundler
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

const trainIcon = L.divIcon({
  html: `<div style="background:#4263eb;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">🚂</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const planeIcon = L.divIcon({
  html: `<div style="background:#12b886;color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);">✈</div>`,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const stationIcon = L.divIcon({
  html: `<div style="background:#f59e0b;color:white;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);">●</div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [10, 10],
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
  const [showAll, setShowAll] = useState(true);
  const [selectedTrip, setSelectedTrip] = useState<number | null>(null);

  useEffect(() => {
    api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  const displayTrips = showAll
    ? trips
    : trips.filter((t) => t.id === selectedTrip);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setShowAll(true); setSelectedTrip(null); }}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
              showAll ? "bg-terracotta-100 text-terracotta-700" : "text-ink-400 hover:bg-parchment-200"
            }`}
          >
            <Layers className="w-3.5 h-3.5 inline mr-1" />
            全部显示
          </button>
        </div>
      </div>

      {/* Trip selector when not showing all */}
      {!showAll && (
        <div className="flex gap-2 overflow-x-auto pb-2 flex-shrink-0">
          {trips.map((t) => (
            <button
              key={t.id}
              onClick={() => setSelectedTrip(t.id === selectedTrip ? null : t.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                t.id === selectedTrip
                  ? t.type === "train" ? "bg-terracotta-100 text-terracotta-700" : "bg-terracotta-50 text-terracotta-600"
                  : "bg-parchment-200 text-ink-500 hover:bg-parchment-300"
              }`}
            >
              {t.trainFlightNumber}: {t.departureStation?.name}→{t.arrivalStation?.name}
            </button>
          ))}
        </div>
      )}

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
                      {trip.type === "train" ? "🚂" : "✈"} {trip.trainFlightNumber}
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
