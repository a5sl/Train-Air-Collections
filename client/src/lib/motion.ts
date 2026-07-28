import { useEffect, useState } from 'react';

/** Current motion scale (0.4 subtle / 1 standard / 1.7 lively). */
export function motionScale(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-scale'));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

/** Current motion speed divisor for durations (subtle=1.6 slower, lively=0.78 faster). */
export function motionSpeed(): number {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--motion-speed'));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function isCoarsePointer(): boolean {
  return window.matchMedia('(pointer: coarse)').matches;
}

/** rAF-driven tween helper. Returns a cancel function. */
export function tween(opts: {
  duration: number;
  ease?: (t: number) => number;
  onUpdate: (t: number) => void;
  onComplete?: () => void;
}): () => void {
  const { duration, ease = (t) => 1 - Math.pow(1 - t, 3), onUpdate, onComplete } = opts;
  let raf = 0;
  let cancelled = false;
  const start = performance.now();
  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min((now - start) / duration, 1);
    onUpdate(ease(t));
    if (t < 1) raf = requestAnimationFrame(tick);
    else onComplete?.();
  };
  raf = requestAnimationFrame(tick);
  return () => { cancelled = true; cancelAnimationFrame(raf); };
}

/** Page scroll progress 0..1, rAF-throttled. */
export function useScrollProgress(): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setP(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); };
  }, []);
  return p;
}