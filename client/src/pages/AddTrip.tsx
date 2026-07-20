import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Train, Plane, Search, Plus, X, ChevronDown } from "lucide-react";
import { api } from "../lib/api";
import { useStationSearch } from "../hooks/useStationSearch";
import OperatorPicker from "../components/OperatorPicker";
import type { Station } from "../../shared/types";

const TIMEZONES = [
  "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul",
  "Asia/Singapore", "Asia/Bangkok", "Asia/Dubai",
  "Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Moscow",
  "America/New_York", "America/Chicago", "America/Los_Angeles",
  "America/Toronto", "America/Sao_Paulo",
  "Australia/Sydney", "Pacific/Auckland",
];

const CURRENCIES = ["CNY", "USD", "EUR", "JPY", "GBP", "HKD", "KRW", "AUD", "CAD", "CHF", "SGD"];

interface FormData {
  type: "train" | "flight";
  date: string;
  departureTime: string;
  arrivalTime: string;
  timezone: string;
  departureStation: Station | null;
  arrivalStation: Station | null;
  operator: string;
  trainFlightNumber: string;
  trainName: string;
  vehicleType: string;
  vehicleNumber: string;
  carriageNumber: string;
  durationMinutes: number | "";
  distanceKm: number | "";
  cost: number | "";
  currency: string;
  seatNumber: string;
  seatClass: string;
  notes: string;
}

const initialForm: FormData = {
  type: "train",
  date: new Date().toISOString().slice(0, 10),
  departureTime: "",
  arrivalTime: "",
  timezone: "Asia/Shanghai",
  departureStation: null,
  arrivalStation: null,
  operator: "",
  trainFlightNumber: "",
  trainName: "",
  vehicleType: "",
  vehicleNumber: "",
  carriageNumber: "",
  durationMinutes: "",
  distanceKm: "",
  cost: "",
  currency: "CNY",
  seatNumber: "",
  seatClass: "",
  notes: "",
};

function StationPicker({
  label,
  value,
  onChange,
  placeholder,
  stationType,
}: {
  label: string;
  value: Station | null;
  onChange: (s: Station | null) => void;
  placeholder: string;
  stationType: "train_station" | "airport";
}) {
  const { results, loading, search } = useStationSearch();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // New station form
  const [newStation, setNewStation] = useState({
    name: "",
    code: "",
    city: "",
    country: "",
    latitude: "",
    longitude: "",
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setQuery(v);
    search(v, stationType);
    setOpen(true);
    if (value) onChange(null);
  };

  const selectStation = (station: Station) => {
    onChange(station);
    setQuery(station.name);
    setOpen(false);
  };

  const createStation = async () => {
    if (!newStation.name || !newStation.city || !newStation.country) return;
    try {
      const created = await api.createStation({
        name: newStation.name,
        code: newStation.code || undefined,
        city: newStation.city,
        country: newStation.country,
        latitude: newStation.latitude ? parseFloat(newStation.latitude) : undefined,
        longitude: newStation.longitude ? parseFloat(newStation.longitude) : undefined,
        type: stationType,
      });
      selectStation(created);
      setIsCreating(false);
      setNewStation({ name: "", code: "", city: "", country: "", latitude: "", longitude: "" });
    } catch (err) {
      alert("创建站点失败");
    }
  };

  return (
    <div ref={ref} className="relative">
      <label className="label-text">{label}</label>
      {value ? (
        <div className="flex items-center gap-2 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{value.name}</p>
            <p className="text-xs text-gray-500">{value.city}</p>
          </div>
          <button onClick={() => { onChange(null); setQuery(""); }} className="text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-9"
              placeholder={placeholder}
              value={query}
              onChange={handleInputChange}
              onFocus={() => { if (query) setOpen(true); }}
            />
          </div>
          {open && (
            <div className="absolute z-50 mt-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
              {loading && <div className="px-3 py-2 text-sm text-gray-400">搜索中...</div>}
              {!loading && results.length === 0 && query && (
                <div className="px-3 py-2">
                  <p className="text-sm text-gray-500 mb-2">未找到匹配站点</p>
                  {!isCreating ? (
                    <button
                      onClick={() => setIsCreating(true)}
                      className="text-sm text-rail-600 font-medium hover:text-rail-700 flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" /> 添加新站点
                    </button>
                  ) : (
                    <div className="space-y-2 p-2 bg-gray-50 rounded-lg">
                      <input className="input-field" placeholder="站点名称 *" value={newStation.name}
                        onChange={e => setNewStation(p => ({...p, name: e.target.value}))} />
                      <input className="input-field" placeholder="代码 (IATA/站码)" value={newStation.code}
                        onChange={e => setNewStation(p => ({...p, code: e.target.value}))} />
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input-field" placeholder="城市 *" value={newStation.city}
                          onChange={e => setNewStation(p => ({...p, city: e.target.value}))} />
                        <input className="input-field" placeholder="国家 *" value={newStation.country}
                          onChange={e => setNewStation(p => ({...p, country: e.target.value}))} />
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input className="input-field" placeholder="纬度" value={newStation.latitude}
                          onChange={e => setNewStation(p => ({...p, latitude: e.target.value}))} />
                        <input className="input-field" placeholder="经度" value={newStation.longitude}
                          onChange={e => setNewStation(p => ({...p, longitude: e.target.value}))} />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={createStation} className="btn-primary text-xs py-1.5 flex-1">
                          创建
                        </button>
                        <button onClick={() => setIsCreating(false)} className="btn-secondary text-xs py-1.5">
                          取消
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {results.map((s) => (
                <div key={s.id} onClick={() => selectStation(s)} className="station-option">
                  <span className="font-medium text-gray-900">{s.name}</span>
                  {s.code && <span className="text-gray-400 ml-1.5">({s.code})</span>}
                  <span className="text-gray-400 ml-2 text-xs">{s.city}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function calcDuration(dep: string, arr: string): number | "" {
  if (!dep || !arr) return "";
  const [dh, dm] = dep.split(":").map(Number);
  const [ah, am] = arr.split(":").map(Number);
  let mins = (ah * 60 + am) - (dh * 60 + dm);
  if (mins < 0) mins += 24 * 60; // cross midnight
  return mins;
}

export default function AddTrip() {
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(false);
  const navigate = useNavigate();

  const update = (patch: Partial<FormData>) => {
    setForm((prev) => {
      const next = { ...prev, ...patch };
      // Auto-calculate duration
      if ("departureTime" in patch || "arrivalTime" in patch) {
        next.durationMinutes = calcDuration(next.departureTime, next.arrivalTime);
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.departureStation || !form.arrivalStation) {
      alert("请选择起止站点");
      return;
    }
    if (!form.date || !form.departureTime || !form.arrivalTime || !form.operator || !form.trainFlightNumber) {
      alert("请填写所有必填项");
      return;
    }
    setSubmitting(true);
    try {
      await api.createTrip({
        type: form.type,
        date: form.date,
        departureTime: form.departureTime,
        arrivalTime: form.arrivalTime,
        timezone: form.timezone,
        departureStationId: form.departureStation.id,
        arrivalStationId: form.arrivalStation.id,
        operator: form.operator,
        trainFlightNumber: form.trainFlightNumber,
        trainName: form.trainName || undefined,
        vehicleType: form.vehicleType || undefined,
        vehicleNumber: form.vehicleNumber || undefined,
        carriageNumber: form.carriageNumber || undefined,
        durationMinutes: form.durationMinutes || undefined,
        distanceKm: form.distanceKm || undefined,
        cost: form.cost || undefined,
        currency: form.currency || undefined,
        seatNumber: form.seatNumber || undefined,
        seatClass: form.seatClass || undefined,
        notes: form.notes || undefined,
      });
      navigate("/trips");
    } catch (err: any) {
      alert("保存失败: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">录新程</h2>
        <p className="text-sm text-gray-500 mt-1">录下一次铁轨或云路之旅</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Transport type toggle */}
        <div>
          <label className="label-text">交通工具</label>
          <div className="flex gap-2">
            {(["train", "flight"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => update({ type: t })}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border-2 text-sm font-medium transition-all ${
                  form.type === t
                    ? t === "train"
                      ? "border-terracotta-500 bg-terracotta-100 text-terracotta-700"
                      : "border-terracotta-400 bg-terracotta-50 text-terracotta-600"
                    : "border-ink-200 bg-parchment-50 text-ink-500 hover:border-terracotta-300"
                }`}
              >
                {t === "train" ? <Train className="w-4 h-4" /> : <Plane className="w-4 h-4" />}
                {t === "train" ? "铁轨" : "云路"}
              </button>
            ))}
          </div>
        </div>

        {/* Required fields section */}
        <div className="card p-5 space-y-4">
          <h3 className="text-xs font-semibold text-ink-400 uppercase tracking-wider">必填</h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="label-text">日期 *</label>
              <input type="date" className="input-field" value={form.date}
                onChange={e => update({ date: e.target.value })} required />
            </div>
            <div>
              <label className="label-text">出发时间 *</label>
              <input type="time" className="input-field" value={form.departureTime}
                onChange={e => update({ departureTime: e.target.value })} required />
            </div>
            <div>
              <label className="label-text">到达时间 *</label>
              <input type="time" className="input-field" value={form.arrivalTime}
                onChange={e => update({ arrivalTime: e.target.value })} required />
            </div>
          </div>

          {form.durationMinutes !== "" && (
            <p className="text-xs text-gray-400">
              预计用时: {Math.floor(Number(form.durationMinutes) / 60)}小时{Number(form.durationMinutes) % 60}分钟
            </p>
          )}

          <div>
            <label className="label-text">时区 *</label>
            <div className="relative">
              <select className="select-field appearance-none pr-8" value={form.timezone}
                onChange={e => update({ timezone: e.target.value })} required>
                {TIMEZONES.map(tz => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StationPicker
              label="出发站点 *"
              value={form.departureStation}
              onChange={(s) => update({ departureStation: s })}
              placeholder="搜索出发站/机场..."
              stationType={form.type === "train" ? "train_station" : "airport"}
            />
            <StationPicker
              label="到达站点 *"
              value={form.arrivalStation}
              onChange={(s) => update({ arrivalStation: s })}
              placeholder="搜索到达站/机场..."
              stationType={form.type === "train" ? "train_station" : "airport"}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OperatorPicker
              label={form.type === "train" ? "铁路运营方 *" : "航空公司 *"}
              value={form.operator}
              onChange={(v) => update({ operator: v })}
              placeholder={form.type === "train" ? "如: 中国国铁, JR东日本" : "如: 全日空, 中国国航"}
            />
            <div>
              <label className="label-text">
                {form.type === "train" ? "车次" : "航班号"} *
              </label>
              <input className="input-field" placeholder={form.type === "train" ? "如: G123" : "如: NH962"}
                value={form.trainFlightNumber} onChange={e => update({ trainFlightNumber: e.target.value })} required />
            </div>
          </div>
        </div>

        {/* Optional fields toggle */}
        <button
          type="button"
          onClick={() => setShowOptional(!showOptional)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ChevronDown className={`w-4 h-4 transition-transform ${showOptional ? "rotate-180" : ""}`} />
          详细信息 (可选)
        </button>

        {showOptional && (
          <div className="card p-5 space-y-4">
            {form.type === "train" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="label-text">车名</label>
                  <input className="input-field" placeholder="如: 和谐号、复兴号" value={form.trainName}
                    onChange={e => update({ trainName: e.target.value })} />
                </div>
                <div>
                  <label className="label-text">车型</label>
                  <input className="input-field" placeholder="如: CRH2A"
                    value={form.vehicleType} onChange={e => update({ vehicleType: e.target.value })} />
                </div>
              </div>
            ) : (
              <div>
                <label className="label-text">机型</label>
                <input className="input-field" placeholder="如: B787-9"
                  value={form.vehicleType} onChange={e => update({ vehicleType: e.target.value })} />
              </div>
            )}
            <div>
              <label className="label-text">{form.type === "train" ? "车辆号码" : "注册号"}</label>
                <input className="input-field" placeholder={form.type === "train" ? "如: CRH2A-2158" : "如: JA123A"}
                  value={form.vehicleNumber} onChange={e => update({ vehicleNumber: e.target.value })} />
              </div>
              <div>
                <label className="label-text">车厢号</label>
                <input className="input-field" placeholder="如: 2, 13" value={form.carriageNumber}
                  onChange={e => update({ carriageNumber: e.target.value })} />
              </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-text">总用时 (分钟)</label>
                <input type="number" className="input-field" placeholder="自动计算" value={form.durationMinutes}
                  onChange={e => update({ durationMinutes: e.target.value ? parseInt(e.target.value) : "" })} />
              </div>
              <div>
                <label className="label-text">总里程 (公里)</label>
                <input type="number" className="input-field" placeholder="如: 1318" value={form.distanceKm}
                  onChange={e => update({ distanceKm: e.target.value ? parseFloat(e.target.value) : "" })} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-text">盘缠</label>
                <input type="number" className="input-field" placeholder="如: 553" value={form.cost}
                  onChange={e => update({ cost: e.target.value ? parseFloat(e.target.value) : "" })} />
              </div>
              <div>
                <label className="label-text">货币</label>
                <div className="relative">
                  <select className="select-field appearance-none pr-8" value={form.currency}
                    onChange={e => update({ currency: e.target.value })}>
                    {CURRENCIES.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-text">座号</label>
                <input className="input-field" placeholder="如: 12A" value={form.seatNumber}
                  onChange={e => update({ seatNumber: e.target.value })} />
              </div>
              <div>
                <label className="label-text">席等</label>
                <input className="input-field" placeholder="如: 二等座 / 经济舱" value={form.seatClass}
                  onChange={e => update({ seatClass: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="label-text">附记</label>
              <textarea className="input-field" rows={2} placeholder="任何你想记录的信息..." value={form.notes}
                onChange={e => update({ notes: e.target.value })} />
            </div>
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary flex-1">
            {submitting ? "保存中..." : "保存行程"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">
            取消
          </button>
        </div>
      </form>
    </div>
  );
}
