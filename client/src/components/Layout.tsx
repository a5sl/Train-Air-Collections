import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Train, Plane, List, MapPin, LayoutDashboard } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "概览" },
  { to: "/add", icon: List, label: "新记录" },
  { to: "/trips", icon: List, label: "全部行程" },
  { to: "/map", icon: MapPin, label: "地图" },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <Train className="w-5 h-5 text-rail-600" />
              <Plane className="w-5 h-5 text-air-500" />
            </div>
            <h1 className="text-lg font-bold text-gray-900 tracking-tight">
              Train-Air Collections
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-md border-t border-gray-200 md:static md:border-t-0 md:bg-transparent md:backdrop-blur-none">
        <div className="max-w-6xl mx-auto px-2 md:px-4">
          <div className="flex justify-around md:justify-start md:gap-1 py-1.5 md:py-0 md:fixed md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:bg-white md:rounded-2xl md:shadow-lg md:border md:border-gray-200 md:px-2 md:py-1.5">
            {navItems.map(({ to, icon: Icon, label }) => {
              const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all
                    ${active
                      ? "text-rail-700 bg-rail-50 md:bg-rail-100"
                      : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                    }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
