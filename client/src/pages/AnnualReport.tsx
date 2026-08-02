import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowDown, ArrowLeft, BookOpen, Calendar, Camera, Clock, Download,
  Leaf, MapPin, Navigation, Plane, RotateCcw, Train,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { api } from "../lib/api";
import type { Trip } from "../../../shared/types";
import CountUp from "../components/CountUp";
import Reveal from "../components/Reveal";
import TrainLoader from "../components/fx/TrainLoader";
import { useToast } from "../components/fx/Toast";
import { prefersReducedMotion } from "../lib/motion";

const EARTH_CIRCUMFERENCE_KM = 40075;
const CO2_KG_PER_KM: Record<"train" | "flight", number> = { train: 0.041, flight: 0.255 };
const TREE_KG_PER_YEAR = 21;
const MONTHS_CN = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];

interface YearStats {
  count: number;
  trainCount: number;
  flightCount: number;
  trainKm: number;
  flightKm: number;
  totalKm: number;
  withDistanceCount: number;
  totalMinutes: number;
  co2Kg: number;
  co2TrainKg: number;
  co2FlightKg: number;
  trees: number;
  earthLaps: number;
  cityCount: number;
  countryCount: number;
  topCities: [string, number][];
  topRoute: { label: string; count: number } | null;
  topOperator: { name: string; count: number } | null;
  longest: { label: string; km: number } | null;
  monthly: number[];
  photos: { url: string; alt: string }[];
}

function computeStats(trips: Trip[]): YearStats {
  let trainCount = 0;
  let flightCount = 0;
  let trainKm = 0;
  let flightKm = 0;
  let totalMinutes = 0;
  let withDistanceCount = 0;
  const cities = new Map<string, number>();
  const countries = new Set<string>();
  const routes = new Map<string, number>();
  const operators = new Map<string, number>();
  const monthly = new Array(12).fill(0) as number[];
  let longest: YearStats["longest"] = null;
  const photos: { url: string; alt: string }[] = [];

  for (const t of trips) {
    if (t.type === "train") trainCount++;
    else flightCount++;
    const km = t.distanceKm ?? 0;
    if (t.distanceKm != null && t.distanceKm > 0) {
      withDistanceCount++;
      if (t.type === "train") trainKm += km;
      else flightKm += km;
    }
    totalMinutes += t.durationMinutes ?? 0;
    const routeLabel = (t.departureStation?.name ?? "?") + " → " + (t.arrivalStation?.name ?? "?");
    const arrCity = t.arrivalStation?.city || t.arrivalStation?.name;
    if (arrCity) cities.set(arrCity, (cities.get(arrCity) ?? 0) + 1);
    if (t.arrivalStation?.country) countries.add(t.arrivalStation.country);
    routes.set(routeLabel, (routes.get(routeLabel) ?? 0) + 1);
    operators.set(t.operator, (operators.get(t.operator) ?? 0) + 1);
    const m = parseInt((t.departureDate || "").slice(5, 7), 10);
    if (m >= 1 && m <= 12) monthly[m - 1]++;
    if (km > (longest?.km ?? 0)) longest = { label: routeLabel, km };
    for (const img of t.images ?? []) {
      if (photos.length < 8) photos.push({ url: img.url, alt: img.originalName || routeLabel });
    }
  }

  const totalKm = trainKm + flightKm;
  const co2TrainKg = trainKm * CO2_KG_PER_KM.train;
  const co2FlightKg = flightKm * CO2_KG_PER_KM.flight;
  const co2Kg = co2TrainKg + co2FlightKg;
  const topCities = Array.from(cities.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topRouteEntry = Array.from(routes.entries()).sort((a, b) => b[1] - a[1])[0];
  const topOperatorEntry = Array.from(operators.entries()).sort((a, b) => b[1] - a[1])[0];

  return {
    count: trips.length,
    trainCount,
    flightCount,
    trainKm,
    flightKm,
    totalKm,
    withDistanceCount,
    totalMinutes,
    co2Kg: Math.round(co2Kg),
    co2TrainKg: Math.round(co2TrainKg),
    co2FlightKg: Math.round(co2FlightKg),
    trees: co2Kg > 0 ? Math.max(1, Math.ceil(co2Kg / TREE_KG_PER_YEAR)) : 0,
    earthLaps: totalKm / EARTH_CIRCUMFERENCE_KM,
    cityCount: cities.size,
    countryCount: countries.size,
    topCities,
    topRoute: topRouteEntry ? { label: topRouteEntry[0], count: topRouteEntry[1] } : null,
    topOperator: topOperatorEntry ? { name: topOperatorEntry[0], count: topOperatorEntry[1] } : null,
    longest,
    monthly,
    photos,
  };
}

function formatKm(n: number): string {
  return Math.round(n).toLocaleString();
}

function cssVarRgb(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!v) return fallback;
  return "rgb(" + v.split(/\s+/).join(", ") + ")";
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function buildShareSvg(
  year: string,
  stats: YearStats,
  colors: { surface: string; content: string; secondary: string; brand: string }
): string {
  const rows: [string, string][] = [
    ["行程", stats.count + " 程"],
    ["里程", formatKm(stats.totalKm) + " km"],
    ["绕赤道", stats.earthLaps.toFixed(2) + " 圈"],
    ["碳迹", stats.co2Kg.toLocaleString() + " kg CO₂e"],
    ["植树", "≈ " + stats.trees + " 棵·年"],
    ["城市", stats.cityCount + " 座"],
  ];
  const rowsSvg = rows
    .map((row, i) => {
      const y = 500 + i * 130;
      return (
        '<text x="140" y="' + y + '" font-family="\'Noto Serif SC\',\'Songti SC\',serif" font-size="42" fill="' + colors.secondary + '">' + escapeXml(row[0]) + "</text>" +
        '<text x="940" y="' + y + '" text-anchor="end" font-family="\'IBM Plex Mono\',Consolas,monospace" font-size="50" font-weight="600" fill="' + colors.content + '">' + escapeXml(row[1]) + "</text>" +
        '<line x1="140" y1="' + (y + 28) + '" x2="940" y2="' + (y + 28) + '" stroke="' + colors.brand + '" stroke-opacity="0.18" stroke-width="1"/>'
      );
    })
    .join("");
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">',
    '<rect width="1080" height="1440" fill="' + colors.surface + '"/>',
    '<rect width="1080" height="20" fill="' + colors.brand + '"/>',
    '<rect y="1420" width="1080" height="20" fill="' + colors.brand + '"/>',
    '<text x="540" y="240" text-anchor="middle" font-family="\'Noto Serif SC\',\'Songti SC\',\'SimSun\',serif" font-size="132" font-weight="700" fill="' + colors.content + '">岁次' + escapeXml(year) + "</text>",
    '<text x="540" y="330" text-anchor="middle" font-family="\'Noto Serif SC\',\'Songti SC\',serif" font-size="40" letter-spacing="16" fill="' + colors.brand + '">行旅年鉴</text>',
    rowsSvg,
    '<text x="540" y="1360" text-anchor="middle" font-family="\'Noto Serif SC\',\'Songti SC\',serif" font-size="28" fill="' + colors.secondary + '">行旅录 · Train-Air Collections</text>',
    "</svg>",
  ].join("");
}

function SlideTitle({ icon: Icon, title, en }: { icon: LucideIcon; title: string; en: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="w-5 h-5 text-brand" />
      <h3 className="text-2xl font-display font-bold text-content">{title}</h3>
      <span className="text-[10px] uppercase tracking-[0.3em] text-content-tertiary">{en}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-line last:border-0">
      <span className="text-xs text-content-secondary flex-shrink-0">{label}</span>
      <span className="text-sm font-medium text-content text-right">{value}</span>
    </div>
  );
}

function SplitBar({
  left,
  right,
  leftLabel,
  rightLabel,
  format,
}: {
  left: number;
  right: number;
  leftLabel: string;
  rightLabel: string;
  format: (n: number) => string;
}) {
  const total = left + right;
  const leftPct = total > 0 ? (left / total) * 100 : 50;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-content-secondary">
        <span>{leftLabel} · {format(left)}</span>
        <span>{format(right)} · {rightLabel}</span>
      </div>
      <div className="h-3 rounded-full overflow-hidden flex bg-line">
        <div className="h-full bg-brand" style={{ width: leftPct + "%" }} />
        <div className="h-full bg-accent" style={{ width: (100 - leftPct) + "%" }} />
      </div>
    </div>
  );
}

function Slide({ children }: { children: React.ReactNode }) {
  return (
    <section className="h-full snap-start flex items-center justify-center p-6 sm:p-10">
      <div className="w-full max-w-3xl max-h-full overflow-y-auto overscroll-contain py-4">{children}</div>
    </section>
  );
}

export default function AnnualReport() {
  const { year: yearParam } = useParams<{ year?: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [allTrips, setAllTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeIdx, setActiveIdx] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .getTrips()
      .then(setAllTrips)
      .catch(() => toast("加载行旅数据失败", "err"))
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(() => {
    const set = new Set<string>();
    allTrips.forEach((t) => {
      const y = (t.departureDate || "").slice(0, 4);
      if (/^\d{4}$/.test(y)) set.add(y);
    });
    return Array.from(set).sort((a, b) => b.localeCompare(a));
  }, [allTrips]);

  const year = useMemo(() => {
    if (yearParam && years.includes(yearParam)) return yearParam;
    return years[0] ?? String(new Date().getFullYear());
  }, [yearParam, years]);

  const yearTrips = useMemo(
    () => allTrips.filter((t) => (t.departureDate || "").startsWith(year)),
    [allTrips, year]
  );
  const stats = useMemo(() => computeStats(yearTrips), [yearTrips]);
  const maxMonthly = Math.max(...stats.monthly, 1);
  const days = Math.floor(stats.totalMinutes / 1440);
  const hours = Math.floor((stats.totalMinutes % 1440) / 60);

  useEffect(() => {
    if (loading || years.length === 0) return;
    if (yearParam !== year) navigate("/report/" + year, { replace: true });
  }, [loading, years, year, yearParam, navigate]);

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ top: i * el.clientHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  };

  const slides: { id: string; node: React.ReactNode }[] = [];

  slides.push({
    id: "封面",
    node: (
      <div className="text-center space-y-6">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.4em] text-content-tertiary">行旅录 · 年鉴</p>
        </Reveal>
        <Reveal delay={100}>
          <h2 className="text-6xl sm:text-8xl font-display font-bold text-content tracking-tight">岁次{year}</h2>
        </Reveal>
        <Reveal delay={200}>
          <div className="flex items-center justify-center gap-6 text-sm text-content-secondary">
            <span className="flex items-center gap-1.5"><Train className="w-4 h-4 text-brand" />铁轨 {stats.trainCount} 程</span>
            <span className="flex items-center gap-1.5"><Plane className="w-4 h-4 text-brand" />云路 {stats.flightCount} 程</span>
          </div>
        </Reveal>
        <Reveal delay={300}>
          <p className="text-sm text-content-tertiary">共 {stats.count} 程 · 下滑翻阅</p>
        </Reveal>
        <div className="flex justify-center pt-2">
          <ArrowDown className="w-5 h-5 text-content-tertiary animate-bounce" />
        </div>
      </div>
    ),
  });

  if (stats.count > 0) {
    slides.push({
      id: "里程",
      node: (
        <div className="space-y-8">
          <SlideTitle icon={Navigation} title="万里征途" en="Distance" />
          <div className="text-center">
            <div className="text-5xl sm:text-7xl font-display font-bold text-content">
              <CountUp value={Math.round(stats.totalKm)} format={(n) => n.toLocaleString()} />
              <span className="text-2xl text-content-secondary ml-2">km</span>
            </div>
            <p className="mt-3 text-sm text-content-secondary">
              相当于绕赤道 <span className="text-brand font-semibold">{stats.earthLaps.toFixed(2)}</span> 圈
              {stats.withDistanceCount < stats.count && (
                <span className="text-content-tertiary">（依 {stats.withDistanceCount} 程已录里程计）</span>
              )}
            </p>
          </div>
          <SplitBar left={stats.trainKm} right={stats.flightKm} leftLabel="铁轨" rightLabel="云路" format={(n) => formatKm(n) + " km"} />
        </div>
      ),
    });

    slides.push({
      id: "碳迹",
      node: (
        <div className="space-y-8">
          <SlideTitle icon={Leaf} title="碳迹留痕" en="Carbon" />
          <div className="text-center">
            <div className="text-5xl sm:text-7xl font-display font-bold text-content">
              <CountUp value={stats.co2Kg} format={(n) => n.toLocaleString()} />
              <span className="text-xl sm:text-2xl text-content-secondary ml-2">kg CO₂e</span>
            </div>
            <p className="mt-3 text-sm text-content-secondary">
              约需 <span className="text-brand font-semibold">{stats.trees}</span> 棵成年树工作一年方可抵消
            </p>
          </div>
          <SplitBar left={stats.co2TrainKg} right={stats.co2FlightKg} leftLabel="铁轨" rightLabel="云路" format={(n) => Math.round(n).toLocaleString() + " kg"} />
          <p className="text-xs text-content-tertiary leading-relaxed">
            估算系数：铁路 0.041、民航 0.255 kg CO₂e／人·公里；仅基于已录里程，供玩味而已。
          </p>
        </div>
      ),
    });

    slides.push({
      id: "光阴",
      node: (
        <div className="space-y-8">
          <SlideTitle icon={Clock} title="光阴流转" en="Time" />
          <div className="text-center space-y-2">
            <div className="text-4xl sm:text-6xl font-display font-bold text-content">
              {days > 0 && (
                <>
                  <CountUp value={days} />
                  <span className="text-xl text-content-secondary mx-1">天</span>
                </>
              )}
              <CountUp value={hours} />
              <span className="text-xl text-content-secondary ml-1">小时</span>
            </div>
            <p className="text-sm text-content-secondary">路上光阴，皆成阅历</p>
          </div>
          <div className="card p-5">
            {stats.longest && (
              <Row label="至远之行" value={stats.longest.label + " · " + formatKm(stats.longest.km) + " km"} />
            )}
            <Row label="平均一程" value={stats.count > 0 ? formatKm(stats.totalKm / stats.count) + " km" : "-"} />
            {stats.topOperator && (
              <Row label="最常乘" value={stats.topOperator.name + "（" + stats.topOperator.count + " 次）"} />
            )}
          </div>
        </div>
      ),
    });

    slides.push({
      id: "足迹",
      node: (
        <div className="space-y-8">
          <SlideTitle icon={MapPin} title="足迹所至" en="Places" />
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="card p-5">
              <div className="text-4xl font-display font-bold text-content"><CountUp value={stats.cityCount} /></div>
              <p className="text-xs text-content-secondary mt-1">城市</p>
            </div>
            <div className="card p-5">
              <div className="text-4xl font-display font-bold text-content"><CountUp value={stats.countryCount} /></div>
              <p className="text-xs text-content-secondary mt-1">国家／地区</p>
            </div>
          </div>
          {stats.topRoute && (
            <div className="card p-5">
              <Row label="常履之途" value={stats.topRoute.label + "（" + stats.topRoute.count + " 次）"} />
            </div>
          )}
          {stats.topCities.length > 0 && (
            <div className="flex flex-wrap gap-2 justify-center">
              {stats.topCities.map(([city, count]) => (
                <span key={city} className="px-3 py-1.5 rounded-lg bg-brand-tint text-sm text-content">
                  {city}<span className="ml-1.5 text-xs text-brand">{count}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      ),
    });

    slides.push({
      id: "月令",
      node: (
        <div className="space-y-8">
          <SlideTitle icon={Calendar} title="月令" en="By Month" />
          <div className="card p-5">
            <div className="flex items-end gap-1.5 sm:gap-2">
              {stats.monthly.map((c, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-mono text-content-tertiary h-3">{c > 0 ? c : ""}</span>
                  <div className="w-full flex items-end" style={{ height: 120 }}>
                    <div className="w-full rounded-t-md bg-brand/70" style={{ height: Math.round((c / maxMonthly) * 120) + "px" }} />
                  </div>
                  <span className="text-[10px] text-content-secondary whitespace-nowrap">{MONTHS_CN[i]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ),
    });

    if (stats.photos.length > 0) {
      slides.push({
        id: "掠影",
        node: (
          <div className="space-y-6">
            <SlideTitle icon={Camera} title="途中掠影" en="Moments" />
            <div className="grid grid-cols-4 gap-2">
              {stats.photos.map((p, i) => (
                <div key={i} className="aspect-square rounded-lg overflow-hidden bg-line">
                  <img src={p.url} alt={p.alt} loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.visibility = "hidden"; }} />
                </div>
              ))}
            </div>
            <p className="text-xs text-content-tertiary text-center">辑得 {stats.photos.length} 帧</p>
          </div>
        ),
      });
    }

    slides.push({
      id: "结语",
      node: (
        <div className="text-center space-y-8">
          <h3 className="text-4xl sm:text-5xl font-display font-bold text-content">山高水长</h3>
          <p className="text-sm text-content-secondary">
            {year} 年共 {stats.count} 程 · {formatKm(stats.totalKm)} km · {stats.cityCount} 城
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => handleShare()} className="btn-primary"><Download className="w-4 h-4" />分享年鉴</button>
            <button onClick={() => goTo(0)} className="btn-secondary"><RotateCcw className="w-4 h-4" />从头翻阅</button>
            <button onClick={() => navigate("/")} className="btn-secondary"><ArrowLeft className="w-4 h-4" />返回概览</button>
          </div>
        </div>
      ),
    });
  } else {
    slides.push({
      id: "留白",
      node: (
        <div className="text-center space-y-4">
          <BookOpen className="w-12 h-12 text-content-tertiary mx-auto" />
          <h3 className="text-xl font-display font-bold text-content">此岁尚无行旅</h3>
          <p className="text-sm text-content-secondary">录下第一段旅途，来年此时便有年鉴可翻。</p>
          <div className="flex justify-center gap-3 pt-2">
            <button onClick={() => navigate("/add")} className="btn-primary">启程录之</button>
            <button onClick={() => navigate("/")} className="btn-secondary">返回概览</button>
          </div>
        </div>
      ),
    });
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const idx = Math.round(el.scrollTop / Math.max(el.clientHeight, 1));
    setActiveIdx(Math.max(0, Math.min(idx, slides.length - 1)));
    const max = el.scrollHeight - el.clientHeight;
    if (progressRef.current) {
      progressRef.current.style.width = (max > 0 ? (el.scrollTop / max) * 100 : 0) + "%";
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement;
    if (target !== e.currentTarget && target.closest("button, a, input, textarea, select")) return;
    if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
      e.preventDefault();
      goTo(Math.min(activeIdx + 1, slides.length - 1));
    } else if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      goTo(Math.max(activeIdx - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      goTo(0);
    } else if (e.key === "End") {
      e.preventDefault();
      goTo(slides.length - 1);
    }
  };

  const handleShare = async () => {
    try {
      const svg = buildShareSvg(year, stats, {
        surface: cssVarRgb("--c-surface", "#faf6f0"),
        content: cssVarRgb("--c-content", "#2b2620"),
        secondary: cssVarRgb("--c-content-secondary", "#8a8074"),
        brand: cssVarRgb("--c-brand", "#b47157"),
      });
      const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("SVG 渲染超时")), 5000);
        img.onload = () => { clearTimeout(timer); resolve(); };
        img.onerror = () => { clearTimeout(timer); reject(new Error("SVG 渲染失败")); };
        img.src = url;
      });
      const scale = 2;
      const canvas = document.createElement("canvas");
      canvas.width = 1080 * scale;
      canvas.height = 1440 * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas 不可用");
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
      if (!blob) throw new Error("Canvas 导出失败");
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = "行旅年鉴-" + year + ".png";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      toast("年鉴已保存为图片", "ok");
    } catch (e: any) {
      toast("生成图片失败: " + (e?.message || "未知错误"), "err");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <TrainLoader className="max-w-xs" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="btn-secondary" aria-label="返回概览">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-xl font-display font-bold text-content">行旅年鉴</h2>
        </div>
        {years.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {years.map((y) => (
              <button
                key={y}
                onClick={() => navigate("/report/" + y)}
                className={
                  "px-2.5 py-1 rounded-lg text-xs font-mono transition-colors " +
                  (y === year
                    ? "bg-brand-tint text-brand font-semibold"
                    : "text-content-tertiary hover:text-content")
                }
              >
                {y}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative">
        <div className="absolute top-0 left-0 right-0 z-20 h-0.5 bg-line/60 pointer-events-none">
          <div ref={progressRef} className="h-full bg-brand" style={{ width: "0%" }} />
        </div>
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          onKeyDown={handleKey}
          tabIndex={0}
          role="region"
          aria-label={"岁次" + year + "行旅年鉴"}
          className="snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-2xl border border-line outline-none focus:ring-2 focus:ring-brand/30"
          style={{ height: "calc(100dvh - 250px)", minHeight: 420 }}
        >
          {slides.map((s) => (
            <Slide key={s.id}>{s.node}</Slide>
          ))}
        </div>

        {slides.length > 1 && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex flex-col gap-2 z-10">
            {slides.map((s, i) => (
              <button
                key={s.id}
                aria-label={s.id}
                aria-current={i === activeIdx ? "true" : undefined}
                title={s.id}
                onClick={() => goTo(i)}
                className={
                  "w-2 rounded-full transition-all " +
                  (i === activeIdx ? "h-5 bg-brand" : "h-2 bg-line hover:bg-content-tertiary")
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
