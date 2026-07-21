import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Train, Plane, Clock, MapPin, BarChart3, Plus,
  TrendingUp, Star, Navigation, Calendar, DollarSign,
} from "lucide-react";
import { api } from "../lib/api";
import type { Trip } from "../../shared/types";

// ---- Helpers ----

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "¥",
  JPY: "¥",
  USD: "$",
  EUR: "€",
  GBP: "£",
  HKD: "HK$",
  TWD: "NT$",
  KRW: "₩",
  THB: "฿",
  SGD: "S$",
  MYR: "RM",
  VND: "₫",
  AUD: "A$",
};



function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes === 0) return minutes === 0 ? "0m" : "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function getMonthLabel(ym: string): string {
  const [, m] = ym.split("-");
  return `${parseInt(m)}月`;
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

// ---- Monthly Bar Chart (simplified, terracotta) ----

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
            <rect x={x} y={chartH - h} width={barW} height={h} rx={4} fill="#b47157" opacity={0.85}>
              <title>{d.label}: {d.total} 次</title>
            </rect>
            <text x={x + barW / 2} y={chartH + 18} textAnchor="middle" fill="#a89484" fontSize="11" fontFamily="inherit">
              {d.label}
            </text>
          </g>
        );
      })}
      {/* subtle baseline */}
      <line x1={0} y1={chartH} x2={totalW} y2={chartH} stroke="#e8cfc3" strokeWidth={1} />
    </svg>
  );
}

// ---- Hero Stat Card (large, gradient) ----

function HeroStatCard({ icon: Icon, label, value }: {
  icon: React.ComponentType<{ className?: string; color?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="card-parchment p-5 hover:shadow-md transition-shadow"
      style={{ background: "linear-gradient(135deg, #fdfaf5 0%, #f3e6df 100%)" }}>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: "rgba(180,113,87,0.12)" }}>
          <Icon className="w-4 h-4" color="#b47157" />
        </div>
        <span className="text-xs font-medium text-ink-400 tracking-wide">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink-800 tracking-tight">{value}</p>
    </div>
  );
}

// ---- Compact Stat Card (left accent line) ----

function CompactStatCard({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string; color?: string }>;
  label: string;
  value: string | number;
  accent: string;
}) {
  return (
    <div className="card-parchment p-4 hover:shadow-md transition-shadow flex items-center gap-3"
      style={{ borderLeftWidth: 3, borderLeftColor: accent, borderLeftStyle: "solid" }}>
      <Icon className="w-4 h-4" color={accent} />
      <div className="min-w-0">
        <p className="text-xs text-ink-400">{label}</p>
        <p className="text-base font-bold text-ink-700 tracking-tight truncate">{value}</p>
      </div>
    </div>
  );
}

// ---- Highlight Row ----

function HighlightRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2 border-b border-ink-100 last:border-0">
      <span className="text-xs text-ink-400 flex-shrink-0 mr-3">{label}</span>
      <span className="text-sm font-medium text-ink-700 text-right truncate">{value}</span>
    </div>
  );
}

// ---- Dashboard ----

export default function Dashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTrips()
      .then(setTrips)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ---- Derived stats ----
  const stats = useMemo(() => {
    const trainTrips = trips.filter((t) => t.type === "train");
    const flightTrips = trips.filter((t) => t.type === "flight");
    const totalDistance = trips.reduce((s, t) => s + (t.distanceKm || 0), 0);
    const totalDuration = trips.reduce((s, t) => s + (t.durationMinutes || 0), 0);
    // Group costs by currency
    const costByCurrency = new Map<string, number>();
    trips.forEach((t) => {
      if (t.cost != null && t.currency != null) {
        costByCurrency.set(t.currency, (costByCurrency.get(t.currency) || 0) + t.cost);
      }
    });
    const topCurrency = costByCurrency.size > 0 ? [...costByCurrency.entries()].sort((a, b) => b[1] - a[1])[0] : null;

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
      const key = (t.departureStation?.name ?? "?") + " → " + (t.arrivalStation?.name ?? "?");
      if (!routeMap.has(key)) {
        routeMap.set(key, {
          dep: t.departureStation?.name ?? "?",
          arr: t.arrivalStation?.name ?? "?",
          count: 0,
        });
      }
      routeMap.get(key)!.count++;
    });
    const topRoutes = Array.from(routeMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    const opMap = new Map<string, number>();
    trips.forEach((t) => opMap.set(t.operator, (opMap.get(t.operator) || 0) + 1));
    const topOperators = Array.from(opMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    let longest: Trip | null = null;
    for (const t of trips) {
      if ((t.distanceKm ?? 0) > (longest?.distanceKm ?? 0)) longest = t;
    }

    const withDist = trips.filter((t) => t.distanceKm != null);
    const avgDistance =
      withDist.length > 0
        ? Math.round(withDist.reduce((s, t) => s + (t.distanceKm ?? 0), 0) / withDist.length)
        : 0;
    const cityMap = new Map<string, number>();
    trips.forEach((t) => {
      const c = t.arrivalStation?.city || t.arrivalStation?.name;
      if (c) cityMap.set(c, (cityMap.get(c) || 0) + 1);
    });
    const topCities = Array.from(cityMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      trainTrips,
      flightTrips,
      totalDistance,
      totalDuration,
      costByCurrency, topCurrency,
      cities: cities.size,
      thisYearTrips: thisYearTrips.length,
      monthly,
      topRoutes,
      topOperators,
      longest,
      avgDistance,
      topCities
    };
  }, [trips]);

  // ---- Loading ----
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 w-20 bg-ink-100 rounded animate-pulse" />
            <div className="h-4 w-40 bg-ink-50 rounded mt-2 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="card-parchment p-4 animate-pulse">
              <div className="h-3 w-12 bg-ink-50 rounded mb-2" />
              <div className="h-7 w-10 bg-ink-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ---- Empty ----
  if (trips.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-ink-800">行旅录</h2>
            <p className="text-sm text-ink-400 mt-1">铁轨纵横，云路万里</p>
          </div>
        </div>
        <div className="card-parchment p-16 text-center">
          <div className="flex justify-center mb-4">
            <Train className="w-12 h-12 text-ink-200" />
          </div>
          <h3 className="text-lg font-medium text-ink-700 mb-2">尚无行旅记载</h3>
          <p className="text-sm text-ink-400 mb-4">录下第一段旅途吧</p>
          <button onClick={() => navigate("/add")}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90"
            style={{ backgroundColor: "#b47157" }}>
            <Plus className="w-4 h-4" />启程录之
          </button>
        </div>
      </div>
    );
  }

  // ---- Main Content ----
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink-800 tracking-tight">行旅录</h2>
          <p className="text-sm text-ink-400 mt-1">铁轨纵横，云路万里</p>
        </div>
        <button onClick={() => navigate("/add")}
          className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:opacity-90"
          style={{ backgroundColor: "#b47157" }}>
          <Plus className="w-4 h-4" />录新程
        </button>
      </div>

      {/* ====== Hero Stats Row ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HeroStatCard icon={BarChart3} label="行旅总计" value={trips.length} />
        <HeroStatCard icon={Train} label="铁轨之行" value={stats.trainTrips.length} />
        <HeroStatCard icon={Plane} label="云中之旅" value={stats.flightTrips.length} />
        <HeroStatCard icon={MapPin} label="足履之城" value={stats.cities} />
      </div>

      {/* ====== Compact Stats Row ====== */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <CompactStatCard icon={Navigation} label="万里征途" value={stats.totalDistance.toLocaleString() + " km"} accent="#ca947a" />
        <CompactStatCard icon={Clock} label="光阴流转" value={formatDuration(stats.totalDuration)} accent="#b47157" />
        <div className="card-parchment p-4 hover:shadow-md transition-shadow flex items-center gap-3"
            style={{ borderLeftWidth: 3, borderLeftColor: "#a05e44", borderLeftStyle: "solid" }}>
            <DollarSign className="w-4 h-4" color="#a05e44" />
            <div className="min-w-0">
              <p className="text-xs text-ink-400">盘缠</p>
              {stats.costByCurrency && stats.costByCurrency.size > 0 ? (
                <div className="flex flex-wrap gap-x-3 gap-y-0">
                  {[...stats.costByCurrency.entries()].map(([cur, amt]) => {
                    const sym = cur + " ";
                    return (
                      <span key={cur} className="text-base font-bold text-ink-700 tracking-tight whitespace-nowrap">
                        {sym}{amt.toLocaleString()}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="text-base font-bold text-ink-700 tracking-tight truncate">-</p>
              )}
            </div>
          </div>
        <CompactStatCard icon={Calendar} label="今岁" value={stats.thisYearTrips + " 次"} accent="#854b36" />

      </div>

      {/* ====== Monthly Chart (parchment bg) ====== */}
      {stats.monthly.length >= 2 && (
        <div className="card-parchment p-5" style={{ backgroundColor: "#faf5ed" }}>
          <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" color="#b47157" />月次行迹
          </h3>
          <div className="overflow-x-auto pb-2 min-w-0">
            <MonthlyChart data={stats.monthly} />
          </div>
        </div>
      )}

      {/* ====== Highlights (lighter parchment) + Top Cities ====== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card-parchment p-5" style={{ backgroundColor: "#fdfaf5" }}>
          <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Star className="w-4 h-4" style={{ color: "#b47157" }} />行旅擷英
          </h3>
          <div className="space-y-0">
            {stats.topOperators.length > 0 && (
              <HighlightRow label="最常乘" value={stats.topOperators[0][0] + " (" + stats.topOperators[0][1] + "次)"} />
            )}
            {stats.topRoutes.length > 0 && (
              <HighlightRow label="常履之途" value={stats.topRoutes[0].dep + " → " + stats.topRoutes[0].arr + " (" + stats.topRoutes[0].count + "次)"} />
            )}
            {stats.longest && (
              <HighlightRow label="至远之行" value={(stats.longest.departureStation?.name ?? "?") + " → " + (stats.longest.arrivalStation?.name ?? "?") + " " + (stats.longest.distanceKm ?? 0).toLocaleString() + "km"} />
            )}
            <HighlightRow label="均程" value={stats.avgDistance.toLocaleString() + " km / 次"} />
          </div>
        </div>

        <div className="card-parchment p-5" style={{ backgroundColor: "#fdfaf5" }}>
          <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4" style={{ color: "#b47157" }} />常至之城
          </h3>
          <div className="space-y-3.5">
            {stats.topCities.map(([city, count], i) => {
              const maxCount = stats.topCities[0][1];
              const pct = Math.round((count / maxCount) * 100);
              const barColors = ["#b47157", "#ca947a", "#d9b19e", "#e8cfc3", "#f3e6df"];
              const rankColors = ["#b47157", "#a89484", "#854b36", "#a89484", "#b8aca1"];
              return (
                <div key={city} className="flex items-center gap-3">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: rankColors[i] }}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-ink-700">{city}</span>
                    <div className="mt-1 h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: "#f3e6df" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: pct + "%", backgroundColor: barColors[i] }} />
                    </div>
                  </div>
                  <span className="text-xs text-ink-400 flex-shrink-0 w-8 text-right">{count}</span>
                </div>
              );
            })}
            {stats.topCities.length === 0 && (
              <p className="text-sm text-ink-400">暂无记载</p>
            )}
          </div>
        </div>
      </div>


      {/* ====== Top Operators ====== */}
      {stats.topOperators.length > 0 && (
        <div className="card-parchment p-5">
          <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-3">惯乘</h3>
          <div className="flex flex-wrap gap-2">
            {stats.topOperators.map(([name, count]) => (
              <span key={name} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm"
                style={{ backgroundColor: "#f5ede0", color: "#4a3728" }}>
                {name}
                <span style={{ color: "#a89484" }} className="text-xs ml-0.5">{count}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
