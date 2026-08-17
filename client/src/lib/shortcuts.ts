import { useEffect, useRef } from 'react';

interface ShortcutHandlers {
  onNavigate: (path: string) => void;
  onFocusSearch: () => void;
  onToggleHelp: () => void;
  onEasterEgg: () => void;
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}

/**
 * 全局快捷键：
 * - g d / g t / g m / g a 跳转页面
 * - / 聚焦搜索
 * - ? 开关驿馆须知
 * - 连敲 g1 触发彩蛋列车
 */
export function useGlobalShortcuts(h: ShortcutHandlers) {
  const ref = useRef(h);
  ref.current = h;
  const pendingG = useRef(0);
  const lastKey = useRef('');
  const lastAt = useRef(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();

      // 彩蛋：900ms 内连敲 g -> 1
      const now = Date.now();
      if (key === 'g' && !isTypingTarget(e.target)) {
        lastKey.current = 'g';
        lastAt.current = now;
      } else if (key === '1' && lastKey.current === 'g' && now - lastAt.current < 900 && !isTypingTarget(e.target)) {
        lastKey.current = '';
        ref.current.onEasterEgg();
        return;
      }

      if (isTypingTarget(e.target)) {
        if (e.key === 'Escape') (e.target as HTMLElement).blur();
        return;
      }

      if (e.key === '?') { e.preventDefault(); ref.current.onToggleHelp(); return; }
      if (e.key === '/') { e.preventDefault(); ref.current.onFocusSearch(); return; }

      if (key === 'g') { pendingG.current = now; return; }
      if (now - pendingG.current < 900) {
        pendingG.current = 0;
        if (key === 'd') { ref.current.onNavigate('/'); return; }
        if (key === 't') { ref.current.onNavigate('/trips'); return; }
        if (key === 'm') { ref.current.onNavigate('/map'); return; }
        if (key === 'c') { ref.current.onNavigate('/catalog'); return; }
        if (key === 'a') { ref.current.onNavigate('/add'); return; }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}