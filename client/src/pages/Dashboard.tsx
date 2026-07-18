import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Train, Plane, Clock, MapPin, BarChart3, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Trip } from "../../shared/types";

export default function Dashboard() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.getTrips().then(setTrips).catch(console.error).finally(() => setLoading(false));
  }, []);

  const trainTrips = trips.filter((t) => t.type === "train");
  const flightTrips = trips.filter((t) => t.type === "flight");
  const totalDistance = trips.reduce((sum, t) => sum + (t.distanceKm || 0), 0);
  const totalDuration = trips.reduce((sum, t) => sum + (t.durationMinutes || 0), 0);
  const uniqueRegions = new Set<string>();
  trips.forEach((t) => {
    if (t.departureStation?.region) uniqueRegions.add(t.departureStation.region);
    if (t.arrivalStation?.region) uniqueRegions.add(t.arrivalStation.region);
  });

  const stats = [
    { label: "总行程", value: trips.length, icon: BarChart3, color: "text-gray-700" },
    { label: "火车", value: trainTrips.length, icon: Train, color: "text-rail-600" },
    { label: "航班", value: flightTrips.length, icon: Plane, color: "text-air-500" },
    { label: "总里程", value: `${totalDistance.toLocaleString()} km`, icon: MapPin, color: "text-blue-600" },
    { label: "总时长", value: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`, icon: Clock, color: "text-amber-600" },
    { label: "到达地区", value: uniqueRegions.size, icon: MapPin, color: "text-emerald-600" },
  ];

  const recentTrips = trips.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">行程概览</h2>
          <p className="text-sm text-gray-500 mt-1">记录你每一次火车与飞行之旅</p>
        </div>
        <button onClick={() => navigate("/add")} className="btn-primary">
          <Plus className="w-4 h-4" />
          新增行程
        </button>
      </div>

      {/* Stats grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 w-16 bg-gray-200 rounded mb-2" />
              <div className="h-8 w-12 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="flex justify-center mb-4">
            <Train className="w-12 h-12 text-gray-300" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">还没有行程记录</h3>
          <p className="text-sm text-gray-500 mb-4">开始记录你的第一段旅程吧</p>
          <button onClick={() => navigate("/add")} className="btn-primary">
            <Plus className="w-4 h-4" />
            记录第一次出行
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {stats.map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="card p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs text-gray-500">{label}</span>
                </div>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Recent trips */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
              最近行程
            </h3>
            <div className="space-y-2">
              {recentTrips.map((trip) => (
                <div
                  key={trip.id}
                  onClick={() => navigate("/trips")}
                  className="card p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow"
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    trip.type === "train" ? "bg-rail-50 text-rail-600" : "bg-air-50 text-air-500"
                  }`}>
                    {trip.type === "train" ? <Train className="w-5 h-5" /> : <Plane className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{trip.trainFlightNumber}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {trip.type === "train" ? "火车" : "航班"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 truncate">
                      {trip.departureStation?.name || "?"} → {trip.arrivalStation?.name || "?"}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-500">{trip.date}</p>
                    <p className="text-xs text-gray-400">{trip.departureTime}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
