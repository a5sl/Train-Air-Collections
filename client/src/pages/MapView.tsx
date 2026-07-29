import React, { useEffect, useState, useRef, useCallback, useReducer } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Train, Plane, Layers, ChevronDown, Filter, X } from 'lucide-react';
import { api } from '../lib/api';
import { wgs84ToGcj02 } from '../lib/coords';
import type { Trip } from '../../../shared/types';
import { onAppearanceChange } from '../lib/theme';

import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });

function readPalette() {
  const cv = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgb = (n: string, fallback: string) => { const v = cv(n); return v ? 'rgb(' + v + ')' : fallback; };
  return {
    trainLine: rgb('--c-train-line', '#C88A3D'),
    flightLine: rgb('--c-flight-line', '#C1443B'),
    trainStation: rgb('--c-train-station', '#C9A23B'),
    flightStation: rgb('--c-flight-station', '#9B3058'),
    bg: rgb('--c-map-bg', '#fdfaf5'),
  };
}
let C = readPalette();

const ZOOM_THRESHOLD = 9;

function normalizeCity(city: string): string {
  let c = city.replace(/\s*\(.*?\)\s*$/, '').trim();
  const EN_TO_CN: Record<string, string> = {
    'beijing': '北京', 'shanghai': '上海', 'guangzhou': '广州',
    'shenzhen': '深圳', 'chengdu': '成都', 'wuhan': '武汉',
    'hangzhou': '杭州', 'xian': '西安', 'chongqing': '重庆',
    'nanjing': '南京', 'kunming': '昆明', 'changsha': '长沙',
    'tianjin': '天津', 'shenyang': '沈阳', 'zhengzhou': '郑州',
    'jinan': '济南', 'xiamen': '厦门', 'fuzhou': '福州',
    'xianggang': '香港', 'hongkong': '香港', 'aomen': '澳门', 'macau': '澳门',
  };
  const lower = c.toLowerCase();
  if (EN_TO_CN[lower]) return EN_TO_CN[lower];
  return c;
}

function pillIcon(mainColor: string, svgInner: string): L.DivIcon {
  return L.divIcon({
    html: '<div style="width:32px;height:32px;background:' + C.bg + ';border:2px solid ' + mainColor + ';border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.15);display:flex;align-items:center;justify-content:center;">' + svgInner + '</div>',
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
}

function dotIcon(mainColor: string, size = 10): L.DivIcon {
  return L.divIcon({
    html: '<div style="width:' + size + 'px;height:' + size + 'px;background:' + mainColor + ';border:2px solid ' + C.bg + ';border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,0.2);"></div>',
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

const trainPill = pillIcon(C.trainStation, '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="' + C.trainStation + '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="12" rx="2"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="3" y1="7" x2="21" y2="7"/><circle cx="8" cy="19" r="1.8" fill="' + C.trainStation + '"/><circle cx="16" cy="19" r="1.8" fill="' + C.trainStation + '"/><rect x="10" y="4" width="4" height="3" rx="1" fill="' + C.trainStation + '"/></svg>');
const planePill = pillIcon(C.flightStation, '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="' + C.flightStation + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12L3 20L8 12L3 4Z"/><line x1="8" y1="12" x2="15" y2="12"/></svg>');
const trainDot = dotIcon(C.trainStation, 10);
const flightDot = dotIcon(C.flightStation, 10);

function bezierArc(start: [number, number], end: [number, number], segments = 48): [number, number][] {
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
  const pts: [number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    pts.push([u * u * lat1 + 2 * u * t * cpLat + t * t * lat2, u * u * lng1 + 2 * u * t * cpLng + t * t * lng2]);
  }
  return pts;
}

function FitBoundsOnFilter({ trips, city }: { trips: Trip[]; city: string | null }) {
  const map = useMap();
  useEffect(() => {
    if (!city) return;
    const coords: [number, number][] = [];
    trips.forEach((t) => {
      if (t.departureStation?.latitude != null && t.departureStation?.longitude != null)
        coords.push(wgs84ToGcj02(t.departureStation.latitude, t.departureStation.longitude));
      if (t.arrivalStation?.latitude != null && t.arrivalStation?.longitude != null)
        coords.push(wgs84ToGcj02(t.arrivalStation.latitude, t.arrivalStation.longitude));
    });
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords).pad(0.3));
  }, [city, trips, map]);
  return null;
}

function MapBounds({ trips }: { trips: Trip[] }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = [];
    trips.forEach((t) => {
      if (t.departureStation?.latitude != null && t.departureStation?.longitude != null)
        coords.push(wgs84ToGcj02(t.departureStation.latitude, t.departureStation.longitude));
      if (t.arrivalStation?.latitude != null && t.arrivalStation?.longitude != null)
        coords.push(wgs84ToGcj02(t.arrivalStation.latitude, t.arrivalStation.longitude));
    });
    if (coords.length > 0) map.fitBounds(L.latLngBounds(coords).pad(0.15));
  }, [trips, map]);
  return null;
}

function ZoomMarkers({ stations, onStationClick, markerClickRef }: {
  stations: Map<number, { name: string; city: string; lat: number; lng: number; type: string }>;
  onStationClick: (city: string) => void;
  markerClickRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useEffect(() => { const fn = () => setZoom(map.getZoom()); map.on('zoomend', fn); return () => { map.off('zoomend', fn); }; }, [map]);
  const usePills = zoom >= ZOOM_THRESHOLD;
  return (
    <>
      {Array.from(stations.values()).map((s) => {
        const gcj = wgs84ToGcj02(s.lat, s.lng);
        const icon = usePills ? (s.type === 'train' ? trainPill : planePill) : (s.type === 'train' ? trainDot : flightDot);
        return (
          <Marker key={s.name + s.lat} position={gcj} icon={icon}
            eventHandlers={{ click: () => { markerClickRef.current = true; onStationClick(s.city); } }}>
            <Popup><div className="text-sm"><p className="font-semibold font-display">{s.name}</p><p className="text-content-secondary text-xs">{s.city}</p></div></Popup>
          </Marker>
        );
      })}
    </>
  );
}

function MapClickClear({ onClear, markerClickRef }: { onClear: () => void; markerClickRef: React.MutableRefObject<boolean> }) {
  const map = useMap();
  useEffect(() => {
    const fn = () => { if (!markerClickRef.current) onClear(); markerClickRef.current = false; };
    map.on('click', fn);
    return () => { map.off('click', fn); };
  }, [map, onClear, markerClickRef]);
  return null;
}

export default function MapView() {
  const [, refreshPalette] = useReducer((x: number) => x + 1, 0);
  useEffect(() => onAppearanceChange(() => { C = readPalette(); refreshPalette(); }), []);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'train' | 'flight'>('all');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const markerClickRef = useRef(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false)); }, []);

  const displayTrips = trips.filter((t) => {
    if (filterMode !== 'all' && t.type !== filterMode) return false;
    if (selectedCity) {
      const target = normalizeCity(selectedCity);
      const depCity = t.departureStation?.city ?? '';
      const arrCity = t.arrivalStation?.city ?? '';
      if (normalizeCity(depCity) !== target && normalizeCity(arrCity) !== target) return false;
    }
    return true;
  });

  const curves = displayTrips
    .filter((t) => t.departureStation?.latitude && t.departureStation?.longitude && t.arrivalStation?.latitude && t.arrivalStation?.longitude)
    .map((t) => {
      const start: [number, number] = [t.departureStation!.latitude!, t.departureStation!.longitude!];
      const end: [number, number] = [t.arrivalStation!.latitude!, t.arrivalStation!.longitude!];
      const gcjStart = wgs84ToGcj02(start[0], start[1]);
      const gcjEnd = wgs84ToGcj02(end[0], end[1]);
      return { trip: t, positions: bezierArc(gcjStart, gcjEnd) };
    });

  const stationSet = new Map<number, { name: string; city: string; lat: number; lng: number; type: string }>();
  displayTrips.forEach((t) => {
    const add = (s: typeof t.departureStation) => {
      if (s?.latitude && s?.longitude && s.id && !stationSet.has(s.id))
        stationSet.set(s.id, { name: s.name, city: s.city, lat: s.latitude, lng: s.longitude, type: t.type });
    };
    add(t.departureStation);
    add(t.arrivalStation);
  });

  const handleStationClick = useCallback((city: string) => { setSelectedCity(city); }, []);
  const clearCityFilter = useCallback(() => { setSelectedCity(null); }, []);
  const displayCityName = selectedCity ? normalizeCity(selectedCity) : null;

  const filterOptions = [
    { value: 'all' as const, label: '全部显示', desc: '' },
    { value: 'train' as const, label: '仅铁轨', desc: '' },
    { value: 'flight' as const, label: '仅云路', desc: '' },
  ];

  return (
    <div className="space-y-4 h-[calc(100vh-12rem)] flex flex-col">
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-content">行旅舆图</h2>
          <p className="text-sm text-content-secondary mt-1">{trips.filter((t) => t.departureStation?.latitude).length} 条可示之行旅</p>
        </div>
        <div className="flex items-center gap-2" ref={dropdownRef}>
          <div className="relative">
            <button onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-brand-tint text-brand-deep hover:bg-brand/20 transition-colors">
              <Filter className="w-3.5 h-3.5" />
              {filterMode === 'all' ? '全部显示' : filterMode === 'train' ? '仅铁轨' : '仅云路'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-surface-card border border-line rounded-lg shadow-lg overflow-hidden z-50">
                {filterOptions.map(({ value, label }) => (
                  <button key={value} onClick={() => { setFilterMode(value); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors ${filterMode === value ? 'bg-brand-tint text-brand-deep font-medium' : 'text-content hover:bg-surface-card-alt'}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedCity && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-surface-card-alt rounded-lg border border-line flex-shrink-0">
          <span className="text-sm text-content">正在显示「<span className="font-semibold text-content">{displayCityName}</span>」的行程 · 共 {displayTrips.length} 条</span>
          <button onClick={clearCityFilter} className="inline-flex items-center gap-1 text-xs text-brand hover:text-brand-deep font-medium transition-colors">
            <X className="w-3.5 h-3.5" />显示全部
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex-1 card flex items-center justify-center"><p className="text-content-secondary">加载地图中...</p></div>
      ) : (
        <div className="flex-1 card overflow-hidden relative isolate">
          <MapContainer center={[35, 105]} zoom={4} minZoom={3} maxBounds={[[-85, -180], [85, 180]]} maxBoundsViscosity={0.5} className="w-full h-full" scrollWheelZoom={true}>
            <TileLayer attribution='&copy; <a href="https://www.amap.com/">高德地图</a>' url="https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}" subdomains={['1','2','3','4']} noWrap={true} />
            <MapBounds trips={displayTrips} />
            <FitBoundsOnFilter trips={displayTrips} city={selectedCity} />
            <MapClickClear onClear={clearCityFilter} markerClickRef={markerClickRef} />
            <ZoomMarkers stations={stationSet} onStationClick={handleStationClick} markerClickRef={markerClickRef} />
            {curves.map(({ trip, positions }, i) => (
              <Polyline key={'route-' + trip.id + '-' + i} positions={positions}
                pathOptions={{ color: trip.type === 'train' ? C.trainLine : C.flightLine, weight: 3, opacity: 0.7 }}>
                <Popup>
                  <div className="text-sm space-y-1">
                    <p className="font-mono font-semibold">{trip.trainFlightNumber}</p>
                    <p className="text-content-secondary">{trip.departureStation?.name} → {trip.arrivalStation?.name}</p>
                    <p className="text-content-tertiary text-xs">{trip.departureDate} | {trip.operator}</p>
                    {trip.distanceKm && <p className="text-content-tertiary text-xs font-mono">{trip.distanceKm} km</p>}
                  </div>
                </Popup>
              </Polyline>
            ))}
          </MapContainer>
        </div>
      )}

      <div className="flex items-center gap-5 text-xs text-content-secondary flex-shrink-0 flex-wrap">
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: C.trainLine }} /><span>火车</span></div>
        <div className="flex items-center gap-1.5"><div className="w-4 h-0.5 rounded" style={{ backgroundColor: C.flightLine }} /><span>航班</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.trainStation }} /><span>火车站</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: C.flightStation }} /><span>机场</span></div>
      </div>
    </div>
  );
}
