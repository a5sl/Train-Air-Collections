import React, { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Train, Plane, List, MapPin, LayoutDashboard } from 'lucide-react';
import Seal from './Seal';
import ThemeToggle from './ThemeToggle';
import { getCurrentSolarTerm } from '../lib/solarTerm';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '\u6982\u89c8' },
  { to: '/add', icon: List, label: '\u5f55\u7a0b' },
  { to: '/trips', icon: List, label: '\u884c\u65c5\u5168\u5f55' },
  { to: '/map', icon: MapPin, label: '\u8206\u56fe' },
];

function SkyClock() {
  const [time, setTime] = useState('');
  const [term, setTerm] = useState('');

  useEffect(() => {
    setTerm(getCurrentSolarTerm());
    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, '0');
      const m = String(now.getMinutes()).padStart(2, '0');
      const s = String(now.getSeconds()).padStart(2, '0');
      setTime(h + ':' + m + ':' + s);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-content-secondary">\u4eca\u65e5 \u00b7 <span className="text-brand font-medium">{term}</span></span>
      <span className="font-mono text-content-secondary">
        {time.split('').map((ch, i) =>
          ch === ':' ? (
            <span key={i} className="animate-blink">{ch}</span>
          ) : (
            <span key={i}>{ch}</span>
          )
        )}
      </span>
    </div>
  );
}

export default function Layout() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col relative">
      <div className="ambient-noise" />
      <div className="ambient-grid" />
      <svg className="ambient-mountain" viewBox="0 0 1440 120" preserveAspectRatio="none">
        <path
          d="M0,120 L0,80 Q120,40 240,70 Q360,100 480,60 Q600,20 720,50 Q840,80 960,40 Q1080,10 1200,55 Q1320,90 1440,60 L1440,120 Z"
          fill="rgb(var(--c-content))"
        />
      </svg>

      <header className="sticky top-0 z-40 border-b border-line transition-colors"
        style={{ backgroundColor: 'rgb(var(--c-surface) / 0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Seal text="\u9a7f" size={32} />
            <h1 className="text-lg font-display font-bold text-content tracking-tight">
              \u884c\u65c5\u5f55
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <SkyClock />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 relative z-10">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line transition-colors md:static md:border-t-0"
        style={{ backgroundColor: 'rgb(var(--c-surface) / 0.9)', backdropFilter: 'blur(12px)' }}>
        <div className="max-w-6xl mx-auto px-2 md:px-4">
          <div className="flex justify-around md:justify-start md:gap-1 py-1.5 md:py-0 md:fixed md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:bg-surface-card md:rounded-2xl md:shadow-lg md:border md:border-line md:px-2 md:py-1.5">
            {navItems.map(({ to, icon: Icon, label }) => {
              const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={`flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all
                    ${active
                      ? 'text-brand bg-brand-tint'
                      : 'text-content-tertiary hover:text-content hover:bg-surface-card-alt'
                    }`}
                >
                  <div className="relative">
                    <Icon className="w-5 h-5" />
                    {active && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand" />
                    )}
                  </div>
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
