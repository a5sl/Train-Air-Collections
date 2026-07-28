import React, { useRef, useCallback } from 'react';
import { motionScale, prefersReducedMotion } from '../../lib/motion';

/**
 * 3D 倾斜卡片：指针跟随倾斜 + 高光随动。
 */
export default function Tilt({
  children,
  max = 5,
  className = '',
}: {
  children: React.ReactNode;
  max?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    const m = max * motionScale();
    el.style.transition = 'transform 0.08s linear';
    el.style.transform =
      'perspective(900px) rotateX(' + (-py * 2 * m).toFixed(2) + 'deg) rotateY(' + (px * 2 * m).toFixed(2) + 'deg) translateZ(0)';
    el.style.setProperty('--gx', ((px + 0.5) * 100).toFixed(1) + '%');
    el.style.setProperty('--gy', ((py + 0.5) * 100).toFixed(1) + '%');
  }, [max]);

  const onLeave = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.55s var(--ease-stamp)';
    el.style.transform = 'perspective(900px) rotateX(0deg) rotateY(0deg)';
  }, []);

  return (
    <div
      ref={ref}
      className={'tilt-wrap tilt-sheen ' + className}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
    >
      {children}
    </div>
  );
}