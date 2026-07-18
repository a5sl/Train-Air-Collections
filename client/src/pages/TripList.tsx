import React, { useEffect, useState, useRef } from "react";
import { Train, Plane, Clock, MapPin, Trash2, ChevronRight, Search, Upload, Database } from "lucide-react";
import { api } from "../lib/api";
import type { Trip } from "../../shared/types";

export default function TripList() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [seedMsg, setSeedMsg] = useState("");
  const [filter, setFilter] = useState<"all" | "train" | "flight">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const loadTrips = () => {
    setLoading(true);
    api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  };

  useEffect(() => { loadTrips(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm("确定删除此行程？")) return;
    try { await api.deleteTrip(id); setTrips(prev => prev.filter(t => t.id !== id)); }
    catch { alert("删除失败"); }
  };

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const result: any = await api.importTripsCSV(text);
      alert(`导入完成: ${result.imported} 条成功${result.errors.length > 0 ? `, ${result.errors.length} 条失败:\n${result.errors.slice(0, 10).join('\n')}` : ""}`);
      loadTrips();
    } catch (err: any) {
      alert("导入失败: " + err.message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleSeed = async () => {
    try {
      const result: any = await api.seedData();
      setSeedMsg(`已初始化 ${result.stations} 个站点, ${result.operators} 个运营商`);
      setTimeout(() => setSeedMsg(""), 4000);
    } catch { setSeedMsg("初始化失败"); }
  };

  const filtered = trips
    .filter(t => filter === "all" ? true : t.type === filter)
    .filter(t => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.trainFlightNumber.toLowerCase().includes(q) ||
        t.operator.toLowerCase().includes(q) ||
        t.departureStation?.name.toLowerCase().includes(q) ||
        t.arrivalStation?.name.toLowerCase().includes(q) ||
        t.departureStation?.city.toLowerCase().includes(q) ||
        t.arrivalStation?.city.toLowerCase().includes(q)
      );
    });

  const formatDuration = (mins: number | null) => {
    if (!mins) return null;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">全部行程</h2>
          <p className="text-sm text-gray-500 mt-1">{trips.length} 条记录</p>
        </div>
        <div className="flex items-center gap-2">
          {seedMsg && <span className="text-xs text-emerald-600">{seedMsg}</span>}
          <button onClick={handleSeed} className="btn-secondary text-xs" title="初始化车站和运营商数据">
            <Database className="w-3.5 h-3.5" />
            初始化数据
          </button>
          <input type="file" accept=".csv" ref={fileRef} onChange={handleCSVImport} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={importing} className="btn-secondary text-xs">
            <Upload className="w-3.5 h-3.5" />
            {importing ? "导入中..." : "导入CSV"}
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input-field pl-9" placeholder="搜索车次、运营方、站点..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(["all", "train", "flight"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                filter === f ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {f === "all" ? "全部" : f === "train" ? "火车" : "航班"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
              <div className="h-3 w-48 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-500">没有找到匹配的行程</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(trip => (
            <div key={trip.id} className="card p-4 hover:shadow-md transition-shadow group">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                  trip.type === "train" ? "bg-rail-50 text-rail-600" : "bg-air-50 text-air-500"
                }`}>
                  {trip.type === "train" ? <Train className="w-5 h-5" /> : <Plane className="w-5 h-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{trip.trainFlightNumber}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                      {trip.type === "train" ? "火车" : "航班"}
                    </span>
                    <span className="text-sm text-gray-500">{trip.operator}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                    <span className="font-medium">{trip.departureStation?.name || "?"}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                    <span className="font-medium">{trip.arrivalStation?.name || "?"}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {trip.date} {trip.departureTime} - {trip.arrivalTime}
                    </span>
                    {trip.durationMinutes && <span>{formatDuration(trip.durationMinutes)}</span>}
                    {trip.distanceKm && (
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{trip.distanceKm} km</span>
                    )}
                    {trip.departureStation?.region && (
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded">
                        {trip.departureStation.region}
                        {trip.arrivalStation?.region && trip.arrivalStation.region !== trip.departureStation.region
                          ? ` → ${trip.arrivalStation.region}` : ""}
                      </span>
                    )}
                  </div>
                  {(trip.trainName || trip.vehicleType || trip.seatClass) && (
                    <div className="mt-1.5 flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                      {trip.trainName && <span>{trip.trainName}</span>}
                      {trip.vehicleType && <span>{trip.vehicleType}</span>}
                      {trip.vehicleNumber && <span>#{trip.vehicleNumber}</span>}
                      {trip.seatClass && <span>{trip.seatClass}</span>}
                      {trip.seatNumber && <span>{trip.seatNumber}座</span>}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  {trip.cost && (
                    <span className="text-sm font-semibold text-gray-900">
                      {trip.currency || ""} {trip.cost.toLocaleString()}
                    </span>
                  )}
                  <button onClick={() => handleDelete(trip.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
