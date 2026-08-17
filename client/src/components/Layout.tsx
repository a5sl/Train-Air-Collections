import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { List, MapPin, LayoutDashboard, UserRound, BookOpen } from 'lucide-react';
import Seal from './Seal';
import AppearancePopover from './AppearancePopover';
import FxLayer from './fx/FxLayer';
import AmbientLife from './fx/AmbientLife';
import ScrollRail from './fx/ScrollRail';
import EasterTrain from './fx/EasterTrain';
import ShortcutsOverlay from './fx/ShortcutsOverlay';
import { getCurrentSolarTerm } from '../lib/solarTerm';
import { useGlobalShortcuts } from '../lib/shortcuts';
import { api } from '../lib/api';
import { ParallaxBackdrop, HeaderProgress } from './fx/ParallaxBackdrop';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '概览' },
  { to: '/add', icon: List, label: '录程' },
  { to: '/trips', icon: List, label: '行旅全录' },
  { to: '/map', icon: MapPin, label: '舆图' },
  { to: '/catalog', icon: BookOpen, label: '图鉴' },
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
      <span className="text-content-secondary">今日 · <span className="text-brand font-medium">{term}期间</span></span>
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

function UserBadge() {
  const [email, setEmail] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  React.useEffect(() => {
    let alive = true;
    api.getMe().then((me) => {
      if (alive) setEmail(me.email);
    }).catch(() => {
      if (alive) setFailed(true);
    });
    return () => { alive = false; };
  }, []);

  if (!email && !failed) return null;
  return (
    <div
      className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-full border border-line bg-surface-card-alt text-[11px] text-content-secondary max-w-[200px]"
      title={email ? '当前登录' : '未登录'}
    >
      <UserRound className="w-3.5 h-3.5 shrink-0" />
      <span className="truncate">{email ?? '未登录'}</span>
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

  const navLinks = navItems.map(({ to, icon: Icon, label }) => {
    const active = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
    return (
      <NavLink
        key={to}
        to={to}
        className={
          'relative flex flex-col md:flex-row items-center gap-1 md:gap-1.5 px-2.5 py-2 rounded-xl text-xs md:text-sm font-medium transition-all ' +
          (active
            ? 'text-brand bg-brand-tint'
            : 'text-content-tertiary hover:text-content hover:bg-surface-card-alt')
        }
      >
        <div className="relative">
          <Icon className={'w-5 h-5 transition-transform ' + (active ? 'scale-110' : '')} style={{ transitionTimingFunction: 'var(--ease-stamp)' }} />
        </div>
        <span>{label}</span>
      </NavLink>
    );
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
            <UserBadge />
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

      <nav className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none" aria-label="主导航">
        {/* 移动端：全宽贴底栏 */}
        <div
          className="md:hidden border-t border-line pointer-events-auto transition-colors"
          style={{ backgroundColor: 'rgb(var(--c-surface) / 0.9)', backdropFilter: 'blur(12px)' }}
        >
          <div className="max-w-6xl mx-auto px-2 flex justify-around py-1.5">{navLinks}</div>
        </div>
        {/* 桌面端：始终浮动的胶囊，铁轨作底衬 */}
        <div className="hidden md:block relative mx-auto w-fit mb-6">
          <div className="rail-track absolute left-1/2 -translate-x-1/2 bottom-2.5 w-72 max-w-[86vw]" aria-hidden="true" />
          <div className="relative flex gap-1 px-2 py-1.5 bg-surface-card rounded-2xl shadow-lg border border-line pointer-events-auto">
            {navLinks}
          </div>
        </div>
      </nav>
    </div>
  );
}
