import React, { useRef, useCallback } from 'react';
import { motionScale, prefersReducedMotion } from '../../lib/motion';

/**
 * 磁吸按钮：指针靠近时轻微吸向光标方向，离开弹回。
 */
export default function Magnetic({
  children,
  strength = 0.28,
  className = '',
}: {
  children: React.ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const dx = e.clientX - (rect.left + rect.width / 2);
    const dy = e.clientY - (rect.top + rect.height / 2);
    const s = strength * motionScale();
    const tx = Math.max(-7, Math.min(7, dx * s));
    const ty = Math.max(-5, Math.min(5, dy * s));
    el.style.transition = 'transform 0.12s ease-out';
    el.style.transform = 'translate(' + tx.toFixed(1) + 'px,' + ty.toFixed(1) + 'px)';
  }, [strength]);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.5s var(--ease-stamp)';
    el.style.transform = 'translate(0,0)';
  }, []);

  return (
    <div ref={ref} className={'magnetic inline-block ' + className} onPointerMove={onMove} onPointerLeave={onLeave}>
      {children}
    </div>
  );
}