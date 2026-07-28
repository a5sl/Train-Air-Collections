import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Train, Plane, Clock, MapPin, BarChart3, Plus,
  Star, Navigation, Calendar, DollarSign,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Trip } from '../../../shared/types';
import Reveal from '../components/Reveal';
import TelemetryPanel from '../components/TelemetryPanel';
import Ticket from '../components/Ticket';
import Seal from '../components/Seal';
import Tilt from '../components/fx/Tilt';
import Magnetic from '../components/fx/Magnetic';
import TrainLoader from '../components/fx/TrainLoader';

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === 0) return minutes === 0 ? '0m' : '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? h + 'h ' + m + 'm' : m + 'm';
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
    return { trainTrips, flightTrips, totalDistance, totalDuration, costByCurrency, cities: cities.size, thisYearTrips: thisYearTrips.length, topRoutes, topOperators, longest, avgDistance, topCities };
  }, [trips]);

  const latestTrip = trips.length > 0 ? trips[0] : null;

  if (loading) {
    return (
      <div className="space-y-6">
        <TrainLoader className="max-w-xs" />
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
        <div><h2 className="text-2xl font-display font-bold text-content">行旅录</h2><p className="text-sm text-content-secondary mt-1">铁轨纵横，云路万里</p></div>
        <div className="card p-16 text-center">
          <div className="flex justify-center mb-4"><Train className="w-12 h-12 text-content-tertiary" /></div>
          <h3 className="text-lg font-medium text-content mb-2">尚无行旅记录</h3>
          <p className="text-sm text-content-secondary mb-4">录下第一段旅途吧</p>
          <Magnetic><button onClick={() => navigate('/add')} className="btn-primary"><Plus className="w-4 h-4" />启程录之</button></Magnetic>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex items-center justify-between">
          <div><h2 className="text-2xl font-display font-bold text-content tracking-tight">行旅录</h2><p className="text-sm text-content-secondary mt-1">铁轨纵横，云路万里</p></div>
          <Magnetic><button onClick={() => navigate('/add')} className="btn-primary"><Plus className="w-4 h-4" />录新程</button></Magnetic>
        </div>
      </Reveal>

      {latestTrip && (
        <Reveal delay={100}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2"><Tilt max={3.5}><Ticket trip={latestTrip} size="hero" onClick={() => navigate('/edit/' + latestTrip.id)} /></Tilt></div>
            <div className="flex flex-col gap-3">
              <TelemetryPanel label="行旅总计" labelEn="TOTAL TRIPS" value={trips.length} icon={BarChart3} />
              <TelemetryPanel label="万里征途" labelEn="TOTAL DISTANCE" value={stats.totalDistance} unit="km" icon={Navigation} format={(n) => n.toLocaleString()} />
            </div>
          </div>
        </Reveal>
      )}

      <Reveal delay={200}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TelemetryPanel label="铁轨之行" labelEn="RAIL" value={stats.trainTrips.length} icon={Train} />
          <TelemetryPanel label="云中之旅" labelEn="AIR" value={stats.flightTrips.length} icon={Plane} />
          <TelemetryPanel label="足履之城" labelEn="CITIES" value={stats.cities} icon={MapPin} />
          <TelemetryPanel label="今岁" labelEn="THIS YEAR" value={stats.thisYearTrips} unit="次" icon={Calendar} />
        </div>
      </Reveal>

      <Reveal delay={250}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <TelemetryPanel label="光阴流转" labelEn="DURATION" value={stats.totalDuration} icon={Clock} format={(n) => formatDuration(n)} />
          <div className="screen-panel">
            <div className="absolute left-3 top-4 bottom-4 flex flex-col justify-between">{Array.from({ length: 5 }).map((_, i) => (<div key={i} className="w-2 h-px bg-brand/40" />))}</div>
            <div className="pl-5">
              <div className="flex items-center gap-2 mb-1"><DollarSign className="w-3.5 h-3.5 text-screendata/60" /><span className="text-xs text-screentext/60 font-medium">盘缠</span><span className="text-[10px] text-screentext/30 font-mono uppercase tracking-wider">COST</span></div>
              {stats.costByCurrency && stats.costByCurrency.size > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0">{[...stats.costByCurrency.entries()].map(([cur, amt]) => (<span key={cur} className="text-lg font-bold font-mono text-screendata tracking-tight whitespace-nowrap">{cur} {amt.toLocaleString()}</span>))}</div>
              ) : (<p className="text-lg font-bold font-mono text-screendata tracking-tight">-</p>)}
            </div>
          </div>
          <TelemetryPanel label="均程" labelEn="AVG DIST" value={stats.avgDistance} unit="km" icon={Navigation} format={(n) => n.toLocaleString()} />
        </div>
      </Reveal>

      <Reveal delay={300}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Tilt max={2.5} className="card p-5">
            <h3 className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-4 flex items-center gap-2"><Star className="w-4 h-4 text-brand" />行旅擷英</h3>
            <div className="space-y-0">
              {stats.topOperators.length > 0 && <HighlightRow label="最常乘" value={stats.topOperators[0][0] + ' (' + stats.topOperators[0][1] + '次)'} />}
              {stats.topRoutes.length > 0 && <HighlightRow label="常履之途" value={stats.topRoutes[0].dep + ' \u2192 ' + stats.topRoutes[0].arr + ' (' + stats.topRoutes[0].count + '次)'} />}
              {stats.longest && <HighlightRow label="至远之行" value={(stats.longest.departureStation?.name ?? '?') + ' \u2192 ' + (stats.longest.arrivalStation?.name ?? '?') + ' ' + (stats.longest.distanceKm ?? 0).toLocaleString() + 'km'} />}
              <HighlightRow label="均程" value={stats.avgDistance.toLocaleString() + ' km / 次'} />
            </div>
          </Tilt>
          <Tilt max={2.5} className="card p-5">
            <h3 className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-4 flex items-center gap-2"><MapPin className="w-4 h-4 text-brand" />常至之城</h3>
            <div className="flex flex-wrap gap-3">
              {stats.topCities.map(([city, count], i) => (
                <div key={city} className="flex flex-col items-center gap-1">
                  <Seal text={city.slice(0, 1)} size={44} color={i === 0 ? undefined : 'rgb(var(--c-brand) / 0.6)'} />
                  <span className="text-xs text-content-secondary">{city}</span>
                  <span className="font-mono text-[10px] text-content-tertiary">{count}</span>
                </div>
              ))}
              {stats.topCities.length === 0 && <p className="text-sm text-content-secondary">暂无记载</p>}
            </div>
          </Tilt>
        </div>
      </Reveal>

      {stats.topOperators.length > 0 && (
        <Reveal delay={350}>
          <div className="card p-5">
            <h3 className="text-xs font-semibold text-content-secondary uppercase tracking-wider mb-3">惯乘</h3>
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