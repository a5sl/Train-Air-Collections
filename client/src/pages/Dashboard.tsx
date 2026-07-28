import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Train, Plane, Clock, MapPin, BarChart3, Plus,
  TrendingUp, Star, Navigation, Calendar, DollarSign,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Trip } from '../../../shared/types';
import Reveal from '../components/Reveal';
import CountUp from '../components/CountUp';
import TelemetryPanel from '../components/TelemetryPanel';
import Ticket from '../components/Ticket';
import Seal from '../components/Seal';

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === 0) return minutes === 0 ? '0m' : '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
}

function getMonthLabel(ym: string): string {
  const parts = ym.split('-');
  return parseInt(parts[1]) + '\u6708';
}

type MonthlyRow = { key: string; label: string; total: number };

function groupByMonth(trips: Trip[]): MonthlyRow[] {
  const map = new Map<string, number>();
  for (const t of trips) {
    const key = t.departureDate.slice(0, 7);
    map.set(key, (map.get(key) || 0) + 1);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({ key, label: getMonthLabel(key), total: val }));
}

function MonthlyChart({ data }: { data: MonthlyRow[] }) {
  if (data.length === 0) return null;
  const barW = 32;
  const gap = 16;
  const maxVal = Math.max(...data.map((d) => d.total), 1);
  const chartH = 100;
  const totalW = data.length * (barW + gap) - gap;
  const scale = chartH / maxVal;
  return (
    <svg width={totalW} height={chartH + 30} className="overflow-visible flex-shrink-0">
      {data.map((d, i) => {
        const x = i * (barW + gap);
        const h = d.total * scale;
        return (
          <g key={d.key}>
            <rect x={x} y={chartH - h} width={barW} height={h} rx={4} fill="rgb(var(--c-brand))" opacity={0.85}>
              <title>{d.label}: {d.total} \u6b21</title>
            </rect>
            <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fill="rgb(var(--c-content-secondary))" fontSize="11" fontFamily="inherit">
              {d.label}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={chartH} x2={totalW} y2={chartH} stroke="rgb(var(--c-line))" strokeWidth={1} />
    </svg>
  );
}

function HighlightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-line last:border-0">
      <span className="text-xs text-content-secondary flex-shrink-0 mr-3">{label}</span>
      <span className="text-sm font-medium text-content text-right truncate">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const trainTrips = trips.filter((t) => t.type === 'train');
    const flightTrips = trips.filter((t) => t.type === 'flight');
    const totalDistance = trips.reduce((s, t) => s + (t.distanceKm || 0), 0);
    const totalDuration = trips.reduce((s, t) => s + (t.durationMinutes || 0), 0);
    const costByCurrency = new Map<string, number>();
    trips.forEach((t) => {
      if (t.cost != null && t.currency != null) {
        costByCurrency.set(t.currency, (costByCurrency.get(t.currency) || 0) + t.cost);
      }
    });
    const cities = new Set<string>();
    trips.forEach((t) => {
      if (t.departureStation?.city) cities.add(t.departureStation.city);
      if (t.arrivalStation?.city) cities.add(t.arrivalStation.city);
    });
    const thisYear = new Date().getFullYear().toString();
    const thisYearTrips = trips.filter((t) => t.departureDate.startsWith(thisYear));
    const monthly = groupByMonth(trips);
    const routeMap = new Map<string, { dep: string; arr: string; count: number }>();
    trips.forEach((t) => {
      const key = (t.departureStation?.name ?? '?') + ' \u2192 ' + (t.arrivalStation?.name ?? '?');
      if (!routeMap.has(key)) routeMap.set(key, { dep: t.departureStation?.name ?? '?', arr: t.arrivalStation?.name ?? '?', count: 0 });
      routeMap.get(key)!.count++;
    });
    const topRoutes = Array.from(routeMap.values()).sort((a, b) => b.count - a.count).slice(0, 3);
    const opMap = new Map<string, number>();
    trips.forEach((t) => opMap.set(t.operator, (opMap.get(t.operator) || 0) + 1));
    const topOperators = Array.from(opMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
    let longest: Trip | null = null;
    for (const t of trips) { if ((t.distanceKm ?? 0) > (longest?.distanceKm ?? 0)) longest = t; }
    const withDist = trips.filter((t) => t.distanceKm != null);
    const avgDistance = withDist.length > 0 ? Math.round(withDist.reduce((s, t) => s + (t.distanceKm ?? 0), 0) / withDist.length) : 0;
    const cityMap = new Map<string, number>();
    trips.forEach((t) => { const c = t.arrivalStation?.city || t.arrivalStation?.name; if (c) cityMap.set(c, (cityMap.get(c) || 0) + 1); });
    const topCities = Array.from(cityMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    return { trainTrips, flightTrips, totalDistance, totalDuration, costByCurrency, cities: cities.size, thisYearTrips: thisYearTrips.length, monthly, topRoutes, topOperators, longest, avgDistance, topCities };
  }, [trips]);

  const latestTrip = trips.length > 0 ? trips[0] : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-20 bg-line rounded animate-pulse" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse"><div className="h-3 w-12 bg-line rounded mb-2" /><div className="h-7 w-10 bg-line rounded" /></div>
          ))}
        </div>
      </div>
    );
  }

  if (trips.length === 0) {
    return (
      <div className="space-y-6">
        <div><h2 className="text-2xl font-display font-bold text-content">\u884c\u65c5\u5f55</h2><p className="text-sm text-content-secondary mt-1">\u94c1\u8f68\u7eb5\u6a2a\uff0c\u4e91\u8def\u4e07\u91cc</p></div>
        <div className="card p-16 text-center">
          <div className="flex justify-center mb-4"><Train className="w-12 h-12 text-content-tertiary" /></div>
          <h3 className="text-lg font-medium text-content mb-2">\u5c1a\u65e0\u884c\u65c5\u8bb0\u8f7d</h3>
          <p className="text-sm text-content-secondary mb-4">\u5f55\u4e0b\u7b2c\u4e00\u6bb5\u65c5\u9014\u5427</p>
          <button onClick={() => navigate('/add')} className="btn-primary"><Plus className="w-4 h-4" />\u542f\u7a0b\u5f55\u4e4b</button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-display font-bold text-content tracking-tight">\u884c\u65c5\u5f55</h2><p className="text-sm text-content-secondary mt-1">\u94c1\u8f68\u7eb5\u6a2a\uff0c\u4e91\u8def\u4e07\u91cc</p></div>
          <button onClick={() => navigate('/add')} className="btn-primary"><Plus className="w-4 h-4" />\u5f55\u65b0\u7a0b</button>
        </div>
      </Reveal>

      {latestTrip && (
        <Reveal delay={100}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><Ticket trip={latestTrip} size="hero" onClick={() => navigate('/edit/' + latestTrip.id)} /></div>
            <div className="flex flex-col gap-3">
              <TelemetryPanel label="\u884c\u65c5\u603b\u8ba1" labelEn="TOTAL TRIPS" value={trips.length} icon={BarChart3} />
              <TelemetryPanel label="\u4e07\u91cc\u5f81\u9014" labelEn="TOTAL DISTANCE" value={stats.totalDistance} unit="km" icon={Navigation} format={(n) => n.toLocaleString()} />
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={200}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TelemetryPanel label="\u94c1\u8f68\u4e4b\u884c" labelEn="RAIL" value={stats.trainTrips.length} icon={Train} />
          <TelemetryPanel label="\u4e91\u4e2d\u4e4b\u65c5" labelEn="AIR" value={stats.flightTrips.length} icon={Plane} />
          <TelemetryPanel label="\u8db3\u5c65\u4e4b\u57ce" labelEn="CITIES" value={stats.cities} icon={MapPin} />
          <TelemetryPanel label="\u4eca\u5c81" labelEn="THIS YEAR" value={stats.thisYearTrips} unit="\u6b21" icon={Calendar} />
        </div>
      </Reveal>

      <Reveal delay={250}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TelemetryPanel label="\u5149\u9634\u6d41\u8f6c" labelEn="DURATION" value={stats.totalDuration} icon={Clock} format={(n) => formatDuration(n)} />
          <div className="screen-panel">
            <div className="absolute left-3 top-4 bottom-4 flex flex-col justify-between">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="w-2 h-px bg-brand/40" />))}</div>
            <div className="pl-5">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="w-3.5 h-3.5 text-screendata/60" /><span className="text-xs text-screentext/60 font-medium">\u76d8\u7f20</span><span className="text-[10px] text-screentext/30 font-mono uppercase tracking-wider">COST</span></div>
              {stats.costByCurrency && stats.costByCurrency.size > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0">{[...stats.costByCurrency.entries()].map(([cur, amt]) => (<span key={cur} className="text-lg font-bold font-mono text-screendata tracking-tight whitespace-nowrap">{cur} {amt.toLocaleString()}</span>))}</div>
              ) : (<p className="text-lg font-bold font-mono text-screendata tracking-tight">-</p>)}
            </div>
          </div>
          <TelemetryPanel label="\u5747\u7a0b" labelEn="AVG DIST" value={stats.avgDistance} unit="km" icon={Navigation} format={(n) => n.toLocaleString()} />
        </div>
      </Reveal>

      {stats.monthly.length >= 2 && (
        <Reveal delay={300}>
          <div className="card-alt p-5">
            <h3 className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-4 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-brand" />\u6708\u6b21\u884c\u8ff9</h3>
            <div className="overflow-x-auto pb-2 min-w-0"><MonthlyChart data={stats.monthly} /></div>
          </div>
        </Reveal>
      )}

      <Reveal delay={350}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-brand" />\u884c\u65c5\u64f7\u82f1</h3>
            <div className="space-y-0">
              {stats.topOperators.length > 0 && <HighlightRow label="\u6700\u5e38\u4e58" value={stats.topOperators[0][0] + ' (' + stats.topOperators[0][1] + '\u6b21)'} />}
              {stats.topRoutes.length > 0 && <HighlightRow label="\u5e38\u5c65\u4e4b\u9014" value={stats.topRoutes[0].dep + ' \u2192 ' + stats.topRoutes[0].arr + ' (' + stats.topRoutes[0].count + '\u6b21)'} />}
              {stats.longest && <HighlightRow label="\u81f3\u8fdc\u4e4b\u884c" value={(stats.longest.departureStation?.name ?? '?') + ' \u2192 ' + (stats.longest.arrivalStation?.name ?? '?') + ' ' + (stats.longest.distanceKm ?? 0).toLocaleString() + 'km'} />}
              <HighlightRow label="\u5747\u7a0b" value={stats.avgDistance.toLocaleString() + ' km / \u6b21'} />
            </div>
          </div>
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand" />\u5e38\u81f3\u4e4b\u57ce</h3>
            <div className="flex flex-wrap gap-3">
              {stats.topCities.map(([city, count], i) => (
                <div key={city} className="flex flex-col items-center gap-1">
                  <Seal text={city.slice(0, 1)} size={44} color={i === 0 ? undefined : 'rgb(var(--c-brand) / 0.6)'} />
                  <span className="text-xs text-content-secondary">{city}</span>
                  <span className="font-mono text-[10px] text-content-tertiary">{count}</span>
                </div>
              ))}
              {stats.topCities.length === 0 && <p className="text-sm text-content-secondary">\u6682\u65e0\u8bb0\u8f7d</p>}
            </div>
          </div>
        </div>
      </Reveal>

      {stats.topOperators.length > 0 && (
        <Reveal delay={400}>
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-3">\u60ef\u4e58</h3>
            <div className="flex flex-wrap gap-2">
              {stats.topOperators.map(([name, count]) => (
                <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-brand-tint text-content">{name}<span className="text-content-secondary text-xs ml-0.5">{count}</span></span>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </div>
  );
}
