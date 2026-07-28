import React, { useEffect, useRef, useState } from 'react';
import { Palette, Sun, Moon, Monitor, Check } from 'lucide-react';
import {
  STYLES, getStyle, setStyle, getMode, setMode, getMotionLevel, setMotionLevel,
  type StyleId, type ThemeMode, type MotionLevel,
} from '../lib/theme';
import Segmented from './Segmented';

/**
 * 外观偏好：风格包 × 明暗 × 动效强度。
 * 预览卡片直接以目标风格的 CSS 变量作用域渲染迷你票据。
 */
function StylePreviewCard({ id, active, onPick }: { id: StyleId; active: boolean; onPick: () => void }) {
  const meta = STYLES.find((s) => s.id === id)!;
  return (
    <button
      type="button"
      data-style={id}
      data-theme={meta.defaultTheme}
      onClick={onPick}
      className={
        'relative text-left rounded-lg border p-2 transition-all bg-surface group ' +
        (active ? 'border-brand ring-2 ring-brand/40 ' : 'border-line hover:border-brand/50 ')
      }
      style={{ borderRadius: 'var(--radius-card)' }}
      title={meta.tagline}
    >
      {/* 迷你票据预览（使用该风格自己的变量） */}
      <div
        className="h-14 rounded-md border border-line bg-surface-card p-1.5 mb-1.5 overflow-hidden relative"
        style={{ borderRadius: 'calc(var(--radius-card) * 0.6)' }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-[8px] font-bold" style={{ color: 'rgb(var(--c-brand))' }}>G1024</span>
          <span
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border"
            style={{ borderColor: 'rgb(var(--c-brand))', color: 'rgb(var(--c-brand))', fontSize: 6 }}
          >驿</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-display text-[9px] font-bold text-content">京</span>
          <span className="flex-1 border-t border-dashed" style={{ borderColor: 'rgb(var(--c-brand) / 0.4)' }} />
          <span className="font-display text-[9px] font-bold text-content">沪</span>
        </div>
        <div className="mt-1 flex gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <span key={i} className="w-px h-2" style={{ background: 'rgb(var(--c-brand) / ' + (i % 3 === 0 ? 0.7 : 0.3) + ')' }} />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-content font-display">{meta.name}</span>
        {active && (
          <span
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-white animate-stamp-in"
            style={{ background: 'rgb(var(--c-brand))' }}
          >
            <Check className="w-2.5 h-2.5" strokeWidth={3.5} />
          </span>
        )}
      </div>
      <span className="block px-0.5 text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgb(var(--c-content-tertiary))' }}>
        {meta.en}
      </span>
    </button>
  );
}

export default function AppearancePopover() {
  const [open, setOpen] = useState(false);
  const [style, setStyleState] = useState<StyleId>(getStyle());
  const [mode, setModeState] = useState<ThemeMode>(getMode());
  const [motion, setMotionState] = useState<MotionLevel>(getMotionLevel());
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); };
  }, [open]);

  const pickStyle = (id: StyleId) => { setStyle(id); setStyleState(id); };
  const pickMode = (m: ThemeMode) => { setMode(m); setModeState(m); };
  const pickMotion = (lv: MotionLevel) => { setMotionLevel(lv); setMotionState(lv); };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          'relative w-9 h-9 rounded-lg border flex items-center justify-center transition-all group ' +
          (open ? 'border-brand bg-brand-tint text-brand' : 'border-line bg-surface-card text-content-secondary hover:bg-surface-card-alt hover:text-content')
        }
        title="外观偏好"
        aria-label="外观偏好"
      >
        <Palette className={'w-4 h-4 transition-transform duration-500 ' + (open ? 'rotate-90' : 'group-hover:rotate-45')} style={{ transitionTimingFunction: 'var(--ease-stamp)' }} />
      </button>

      {open && (
        <div
          className="popover-in absolute right-0 top-12 w-[352px] max-w-[92vw] card p-4 z-50"
          style={{ boxShadow: 'var(--shadow-pop)' }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <h3 className="font-display font-bold text-content text-sm">外观偏好</h3>
            <span className="text-[10px] font-mono uppercase tracking-wider text-content-tertiary">Appearance</span>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {STYLES.map((s) => (
              <StylePreviewCard key={s.id} id={s.id} active={style === s.id} onPick={() => pickStyle(s.id)} />
            ))}
            <div className="rounded-lg border border-dashed border-line p-2 flex flex-col items-center justify-center text-center" style={{ borderRadius: 'var(--radius-card)' }}>
              <span className="text-[10px] text-content-tertiary leading-relaxed">
                风格即变量作用域<br />切换即时生效
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-xs text-content-secondary flex-shrink-0">明暗</span>
            <Segmented<ThemeMode>
              options={[
                { value: 'system', label: '随天', icon: Monitor },
                { value: 'light', label: '昼', icon: Sun },
                { value: 'dark', label: '夜', icon: Moon },
              ]}
              value={mode}
              onChange={pickMode}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-content-secondary flex-shrink-0">动效</span>
            <Segmented<MotionLevel>
              options={[
                { value: 'subtle', label: '含蓄' },
                { value: 'standard', label: '标准' },
                { value: 'lively', label: '活泼' },
              ]}
              value={motion}
              onChange={pickMotion}
            />
          </div>
        </div>
      )}
    </div>
  );
}