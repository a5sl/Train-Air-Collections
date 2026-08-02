import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

export default function CountUp({
  value,
  duration = 800,
  className = '',
  format,
}: {
  value: number;
  duration?: number;
  className?: string;
  format?: (n: number) => string;
}) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Reset when `value` changes so year/metric switches re-animate
    started.current = false;
    if (prefersReducedMotion()) {
      setDisplay(value);
      return;
    }
    setDisplay(0);
    let raf = 0;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const start = performance.now();
        const from = 0;
        const to = value;
        const tick = (now: number) => {
          const t = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - t, 3);
          setDisplay(Math.round(from + (to - from) * eased));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        obs.unobserve(el);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => { obs.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [value, duration]);

  const text = format ? format(display) : display.toLocaleString();

  return <span ref={ref} className={className}>{text}</span>;
}
