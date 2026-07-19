import React, { useEffect, useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import { Train, Plane, Layers, ChevronDown, Filter, X } from "lucide-react";
import { api } from "../lib/api";
import type { Trip } from "../../shared/types";

// Fix default marker icons in bundler
import iconUrl from "leaflet/dist/images/marker-icon.png";
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

// ---- Color palette ----
const C = {
  trainLine:    "#C88A3D", // 琥珀金
  flightLine:   "#C1443B", // 朱砂
  trainStation: "#C9A23B", // 藤黄
  flightStation:"#9B3058", // 胭脂
  bg:           "#fdfaf5", // parchment-50
};

const ZOOM_THRESHOLD = 9;

// Normalize city name: strip parentheticals + fallback English→Chinese mapping
function normalizeCity(city: string): string {
  let c = city.replace(/\s*\(.*?\)\s*$/, "").trim();
  // Fallback English→Chinese mapping for any legacy data
  const EN_TO_CN: Record<string, string> = {
    "beijing": "北京", "shanghai": "上海", "guangzhou": "广州",
    "shenzhen": "深圳", "chengdu": "成都", "wuhan": "武汉",
    "hangzhou": "杭州", "xian": "西安", "chongqing": "重庆",
    "nanjing": "南京", "kunming": "昆明", "changsha": "长沙",
    "tianjin": "天津", "shenyang": "沈阳", "zhengzhou": "郑州",
    "jinan": "济南", "xiamen": "厦门", "fuzhou": "福州",
    "liuzhou": "柳州", "nanning": "南宁", "guilin": "桂林",
    "guiyang": "贵阳", "haikou": "海口", "sanya": "三亚",
    "hefei": "合肥", "nanchang": "南昌", "harbin": "哈尔滨",
    "changchun": "长春", "dalian": "大连", "zhuhai": "珠海",
    "lanzhou": "兰州", "taiyuan": "太原", "shijiazhuang": "石家庄",
    "wuxi": "无锡", "suzhou": "苏州", "ningbo": "宁波",
    "wenzhou": "温州", "qingdao": "青岛", "yantai": "烟台",
    "huhehaote": "呼和浩特", "hohhot": "呼和浩特",
    "urumqi": "乌鲁木齐", "lhasa": "拉萨", "lasa": "拉萨",
    "xining": "西宁", "yinchuan": "银川",
    "xianggang": "香港", "hongkong": "香港",
    "aomen": "澳门", "macau": "澳门",
  };
  const lower = c.toLowerCase();
  if (EN_TO_CN[lower]) return EN_TO_CN[lower];
  return c;
}

// ---- Icon factories ----
function pillIcon(mainColor: string, svgInner: string): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:32px;height:32px;
      background:${C.bg};
      border:2px solid ${mainColor};
      border-radius:8px;
      box-shadow:0 2px 10px rgba(0,0,0,0.15);
      display:flex;align-items:center;justify-content:center;
    ">${svgInner}</div>`,
    className: "",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function dotIcon(mainColor: string, size = 10): L.DivIcon {
  return L.divIcon({
    html: `<div style="
      width:${size}px;height:${size}px;
      background:${mainColor};
      border:2px solid ${C.bg};
      border-radius:50%;
      box-shadow:0 1px 4px rgba(0,0,0,0.2);
    "></div>`,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

// ---- Icons ----
const trainPill = pillIcon(C.trainStation, `
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${C.trainStation}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="3" y="3" width="18" height="12" rx="2"/>
    <line x1="3" y1="15" x2="21" y2="15"/>
    <line x1="3" y1="7" x2="21" y2="7"/>
    <circle cx="8" cy="19" r="1.8" fill="${C.trainStation}"/>
    <circle cx="16" cy="19" r="1.8" fill="${C.trainStation}"/>
    <rect x="10" y="4" width="4" height="3" rx="1" fill="${C.trainStation}"/>
  </svg>
`);

const planePill = pillIcon(C.flightStation, `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${C.flightStation}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M22 12L3 20L8 12L3 4Z"/>
    <line x1="8" y1="12" x2="15" y2="12"/>
  </svg>
`);

const trainDot = dotIcon(C.trainStation, 10);
const flightDot = dotIcon(C.flightStation, 10);

// ---- Bezier curve helper ----
function bezierArc(
  start: [number, number],
  end: [number, number],
  segments = 48
): [number, number][] {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;

  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;

  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const len = Math.sqrt(dLat * dLat + dLng * dLng) || 1;
  const pLat = -dLng / len;
  const pLng = dLat / len;

  const offset = Math.min(len * 0.28, 8);

  const cpLat = midLat + pLat * offset;
  const cpLng = midLng + pLng * offset;

  const points: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const mt = 1 - t;
    const lat = mt * mt * lat1 + 2 * mt * t * cpLat + t * t * lat2;
    const lng = mt * mt * lng1 + 2 * mt * t * cpLng + t * t * lng2;
    points.push([lat, lng]);
  }
  return points;
}

// ---- Zoom-aware station markers ----
function ZoomMarkers({
  stations,
  onStationClick,
  markerClickRef,
}: {
  stations: Map<number, { name: string; city: string; lat: number; lng: number; type: string }>;
  onStationClick: (city: string) => void;
  markerClickRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const handler = () => setZoom(map.getZoom());
    map.on("zoomend", handler);
    return () => { map.off("zoomend", handler); };
  }, [map]);

  const detail = zoom >= ZOOM_THRESHOLD;

  return (
    <>
      {Array.from(stations.entries()).map(([id, s]) => (
        <Marker
          key={`station-${id}`}
          position={[s.lat, s.lng]}
          icon={
            detail
              ? s.type === "train" ? trainPill : planePill
              : s.type === "train" ? trainDot : flightDot
          }
          eventHandlers={{
            click: () => {
              markerClickRef.current = true;
              onStationClick(s.city);
            },
          }}
        >
          {detail && (
            <Popup>
              <div className="text-sm">
                <p className="font-semibold">{s.name}</p>
                <p className="text-ink-400 text-xs mt-0.5">{s.city}</p>
              </div>
            </Popup>
          )}
        </Marker>
      ))}
    </>
  );
}

// ---- Map click to clear city filter ----
function MapClickClear({
  onClear,
  markerClickRef,
}: {
  onClear: () => void;
  markerClickRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  useEffect(() => {
    const handler = () => {
      // Wait a tick: if a marker was clicked, its handler sets the ref
      // before this map-level handler fires.
      setTimeout(() => {
        if (markerClickRef.current) {
          markerClickRef.current = false;
          return;
        }
        onClear();
      }, 0);
    };
    map.on("click", handler);
    return () => { map.off("click", handler); };
  }, [map, onClear, markerClickRef]);
  return null;
}

// ---- Auto fit bounds when city filter changes ----
function FitBoundsOnFilter({ trips, city }: { trips: Trip[]; city: string | null }) {
  const map = useMap();
  const prevCity = useRef(city);
  useEffect(() => {
    if (city && city !== prevCity.current && trips.length > 0) {
      const coords: [number, number][] = [];
      trips.forEach((t) => {
        if (t.departureStation?.latitude && t.departureStation?.longitude)
          coords.push([t.departureStation.latitude, t.departureStation.longitude]);
        if (t.arrivalStation?.latitude && t.arrivalStation?.longitude)
          coords.push([t.arrivalStation.latitude, t.arrivalStation.longitude]);
      });
      if (coords.length > 0) map.fitBounds(L.latLngBounds(coords).pad(0.1));
    }
    prevCity.current = city;
  }, [city, trips, map]);
  return null;
}

// ---- MapBounds (initial load) ----
function MapBounds({ trips }: { trips: Trip[] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    trips.forEach((t) => {
      if (t.departureStation?.latitude && t.departureStation?.longitude)
        coords.push([t.departureStation.latitude, t.departureStation.longitude]);
      if (t.arrivalStation?.latitude && t.arrivalStation?.longitude)
        coords.push([t.arrivalStation.latitude, t.arrivalStation.longitude]);
    });
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords).pad(0.15));
  }, [trips, map]);
  return null;
}

// ---- Page ----
export default function MapView() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<"all" | "train" | "flight">("all");
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const markerClickRef = useRef(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setDropdownOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  // Two-level filter: type + city (normalize parenthetical suffixes)
  const displayTrips = trips.filter((t) => {
    if (filterMode !== "all" && t.type !== filterMode) return false;
    if (selectedCity) {
      const target = normalizeCity(selectedCity);
      const depCity = t.departureStation?.city ?? "";
      const arrCity = t.arrivalStation?.city ?? "";
      if (normalizeCity(depCity) !== target && normalizeCity(arrCity) !== target) return false;
    }
    return true;
  });

  // Curve data for each trip
  const curves = displayTrips
    .filter(
      (t) =>
        t.departureStation?.latitude &&
        t.departureStation?.longitude &&
        t.arrivalStation?.latitude &&
        t.arrivalStation?.longitude
    )
    .map((t) => {
      const start: [number, number] = [t.departureStation!.latitude!, t.departureStation!.longitude!];
      const end:   [number, number] = [t.arrivalStation!.latitude!,   t.arrivalStation!.longitude!];
      return { trip: t, positions: bezierArc(start, end) };
    });

  // Unique stations from displayed trips
  const stationSet = new Map<number, { name: string; city: string; lat: number; lng: number; type: string }>();
  displayTrips.forEach((t) => {
    const add = (s: typeof t.departureStation) => {
      if (s?.latitude && s?.longitude && s.id && !stationSet.has(s.id)) {
        stationSet.set(s.id, {
          name: s.name,
          city: s.city,
          lat: s.latitude,
          lng: s.longitude,
          type: t.type,
        });
      }
    };
    add(t.departureStation);
    add(t.arrivalStation);
  });

  const handleStationClick = useCallback((city: string) => {
    setSelectedCity(city);
  }, []);

  const clearCityFilter = useCallback(() => {
    setSelectedCity(null);
  }, []);

  // Normalized city for banner display
  const displayCityName = selectedCity ? normalizeCity(selectedCity) : null;

  return (
    <div className="space-y-4 h-[calc(100vh-12rem)] flex flex-col">
      {/* Header */}
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
                    onClick={() => { setFilterMode(mode); setDropdownOpen(false); }}
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

      {/* City filter banner */}
      {selectedCity && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-parchment-100 rounded-lg border border-parchment-200 flex-shrink-0">
          <span className="text-sm text-ink-600">
            正在显示「<span className="font-semibold text-ink-800">{displayCityName}</span>」的行程 · 共 {displayTrips.length} 条
          </span>
          <button
            onClick={clearCityFilter}
            className="inline-flex items-center gap-1 text-xs text-terracotta-600 hover:text-terracotta-700 font-medium transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            显示全部
          </button>
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
            <FitBoundsOnFilter trips={displayTrips} city={selectedCity} />
            <MapClickClear onClear={clearCityFilter} markerClickRef={markerClickRef} />
            <ZoomMarkers
              stations={stationSet}
              onStationClick={handleStationClick}
              markerClickRef={markerClickRef}
            />

            {/* Curved routes */}
            {curves.map(({ trip, positions }, i) => (
              <Polyline
                key={`route-${trip.id}-${i}`}
                positions={positions}
                pathOptions={{
                  color: trip.type === "train" ? C.trainLine : C.flightLine,
                  weight: 3,
                  opacity: 0.7,
                  // dashArray: trip.type === "flight" ? "8 4" : undefined,
                }}
              >
                <Popup>
                  <div className="text-sm space-y-1">
                    <p className="font-semibold">{trip.trainFlightNumber}</p>
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
      <div className="flex items-center gap-5 text-xs text-ink-400 flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: C.trainLine }} />
          <span>火车</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-0.5 rounded" style={{ backgroundColor: C.flightLine }} />
          <span>航班</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.trainStation }} />
          <span>火车站</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.flightStation }} />
          <span>机场</span>
        </div>
      </div>
    </div>
  );
}
