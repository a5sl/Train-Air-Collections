import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { List, MapPin, LayoutDashboard } from 'lucide-react';
import Seal from './Seal';
import AppearancePopover from './AppearancePopover';
import FxLayer from './fx/FxLayer';
import AmbientLife from './fx/AmbientLife';
import ScrollRail from './fx/ScrollRail';
import EasterTrain from './fx/EasterTrain';
import ShortcutsOverlay from './fx/ShortcutsOverlay';
import { getCurrentSolarTerm } from '../lib/solarTerm';
import { useGlobalShortcuts } from '../lib/shortcuts';
import { ParallaxBackdrop, HeaderProgress } from './fx/ParallaxBackdrop';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '概览' },
  { to: '/add', icon: List, label: '录程' },
  { to: '/trips', icon: List, label: '行旅全录' },
  { to: '/map', icon: MapPin, label: '舆图' },
];

function SkyClock() {
  const [time, setTime] = useState('');
  const [term, setTerm] = useState('');

  React.useEffect(() => {
    setTerm(getCurrentSolarTerm());
    const tick = () => {
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      setTime(hh + ':' + mm + ':' + ss);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 text-xs">
      <span className="text-content-secondary">今日 · <span className="text-brand font-medium">{term}</span></span>
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
  const navigate = useNavigate();
  const [helpOpen, setHelpOpen] = useState(false);
  const [eggRun, setEggRun] = useState(0);

  useGlobalShortcuts({
    onNavigate: (p) => navigate(p),
    onFocusSearch: () => {
      navigate('/trips');
      setTimeout(() => document.getElementById('trip-search')?.focus(), 120);
    },
    onToggleHelp: () => setHelpOpen((v) => !v),
    onEasterEgg: () => setEggRun((n) => n + 1),
  });

  return (
    <div className="min-h-screen flex flex-col relative">
      <FxLayer />
      <AmbientLife />
      <ScrollRail />
      <EasterTrain runId={eggRun} />
      <ShortcutsOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />

      <ParallaxBackdrop />

      <header
        className="sticky top-0 z-40 border-b border-line transition-colors"
        style={{ backgroundColor: 'rgb(var(--c-surface) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Seal text="驿" size={32} />
            <h1 className="text-lg font-display font-bold text-content tracking-tight">行旅录</h1>
            <span className="hidden sm:inline vertical-text text-[9px] text-content-tertiary select-none" style={{ height: 34 }}>
              驿轨
            </span>
          </div>
          <div className="flex items-center gap-3">
            <SkyClock />
            <AppearancePopover />
          </div>
        </div>
        <HeaderProgress />
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6 pb-24 relative z-10">
        <div key={location.pathname} className="page-enter">
          <Outlet />
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-line transition-colors md:static md:border-t-0"
        style={{ backgroundColor: 'rgb(var(--c-surface) / 0.9)', backdropFilter: 'blur(12px)' }}
      >
        <div className="rail-track hidden md:block" style={{ maxWidth: '36rem', margin: '0 auto' }} />
        <div className="max-w-6xl mx-auto px-2 md:px-4">
          <div className="flex justify-around md:justify-start md:gap-1 py-1.5 md:py-0 md:fixed md:bottom-6 md:left-1/2 md:-translate-x-1/2 md:bg-surface-card md:rounded-2xl md:shadow-lg md:border md:border-line md:px-2 md:py-1.5">
            {navItems.map(({ to, icon: Icon, label }) => {
              const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={
                    'relative flex flex-col md:flex-row items-center gap-1 md:gap-2 px-3 py-2 rounded-xl text-xs md:text-sm font-medium transition-all ' +
                    (active
                      ? 'text-brand bg-brand-tint'
                      : 'text-content-tertiary hover:text-content hover:bg-surface-card-alt')
                  }
                >
                  <div className="relative">
                    <Icon className={'w-5 h-5 transition-transform ' + (active ? 'scale-110' : '')} style={{ transitionTimingFunction: 'var(--ease-stamp)' }} />
                    {active && (
                      <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-brand animate-stamp-in" />
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