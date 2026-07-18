import React from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Train, Plane, List, MapPin, LayoutDashboard } from "lucide-react";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "概览" },
  { to: "/add", icon: List, label: "录程" },
  { to: "/trips", icon: List, label: "行旅全录" },
  { to: "/map", icon: MapPin, label: "舆图" },
];

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-parchment-50/90 backdrop-blur-md border-b border-terracotta-200">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              <Train className="w-5 h-5 text-terracotta-500" />
              <Plane className="w-5 h-5 text-terracotta-400" />
            </div>
            <h1 className="text-lg font-bold text-ink-800 tracking-tight">
              行旅录
            </h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile-first) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-parchment-50/90 backdrop-blur-md border-t border-terracotta-200 md:static md:border-t-0 md:bg-transparent md:backdrop-blur-none">
        <div className="max-w-6xl mx-auto px-2 md:px-4">
          <div className="flex justify-around md:justify-start md:gap-1 py-1.5 md:py-0 md:fixed md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:bg-parchment-50 md:rounded-2xl md:shadow-lg md:border md:border-terracotta-200 md:px-2 md:py-1.5">
            {navItems.map(({ to, icon: Icon, label }) => {
              const active = to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all
                    ${active
                      ? "text-terracotta-700 bg-terracotta-100 md:bg-terracotta-100"
                      : "text-ink-400 hover:text-ink-700 hover:bg-parchment-100"
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
