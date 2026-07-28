import React, { useEffect, useRef } from 'react';
import { motionScale, prefersReducedMotion, isCoarsePointer } from '../../lib/motion';
import { onAppearanceChange, cssVar } from '../../lib/theme';

interface Particle {
  x: number; y: number;
  r: number; growth: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  alpha: number;
}

/**
 * 全局交互特效层：
 * - 墨迹光标轨迹（pointermove，墨点洇开）
 * - 钤印点击涟漪（pointerdown）
 * - 输入落墨（输入框击键微弹）
 */
export default function FxLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion() || isCoarsePointer()) return;

    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let brand = cssVar('--c-brand') || '180 113 87';
    const off = onAppearanceChange(() => { brand = cssVar('--c-brand') || brand; });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: Particle[] = [];
    let raf = 0;
    let running = false;
    let lastX = -1;
    let lastY = -1;

    const loop = () => {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life += 16;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.growth;
        const t = p.life / p.maxLife;
        if (t >= 1) { particles.splice(i, 1); continue; }
        const a = p.alpha * (1 - t);
        ctx.beginPath();
        ctx.fillStyle = 'rgb(' + brand + ' / ' + a.toFixed(3) + ')';
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = 'rgb(' + brand + ' / ' + (a * 0.5).toFixed(3) + ')';
        ctx.arc(p.x + p.r * 1.4, p.y - p.r * 0.9, p.r * 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
      if (particles.length > 0) raf = requestAnimationFrame(loop);
      else { running = false; ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); }
    };
    const ensureLoop = () => { if (!running) { running = true; raf = requestAnimationFrame(loop); } };

    const onMove = (e: PointerEvent) => {
      const scale = motionScale();
      if (scale <= 0.05) return;
      const gap = 34 / scale;
      if (lastX < 0) { lastX = e.clientX; lastY = e.clientY; return; }
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      const dist = Math.hypot(dx, dy);
      if (dist < gap) return;
      lastX = e.clientX; lastY = e.clientY;
      if (particles.length > 90) particles.shift();
      const speedBoost = Math.min(dist / 60, 1.6);
      particles.push({
        x: e.clientX + (Math.random() - 0.5) * 6,
        y: e.clientY + (Math.random() - 0.5) * 6,
        r: 1.6 + Math.random() * 2.2,
        growth: 0.16 + Math.random() * 0.22,
        vx: (Math.random() - 0.5) * 0.35,
        vy: 0.12 + Math.random() * 0.3,
        life: 0,
        maxLife: 620 + Math.random() * 380,
        alpha: Math.min(0.10 + 0.10 * speedBoost, 0.24) * Math.min(scale, 1.4),
      });
      ensureLoop();
    };

    const onDown = (e: PointerEvent) => {
      const scale = motionScale();
      if (scale <= 0.05) return;
      const el = document.createElement('div');
      el.className = 'stamp-ripple';
      const size = 30 * Math.min(Math.max(scale, 0.6), 1.5);
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.margin = (-size / 2) + 'px 0 0 ' + (-size / 2) + 'px';
      el.style.left = e.clientX + 'px';
      el.style.top = e.clientY + 'px';
      host.appendChild(el);
      el.addEventListener('animationend', () => el.remove(), { once: true });
      setTimeout(() => el.remove(), 1400);
    };

    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if ((tag === 'INPUT' || tag === 'TEXTAREA') && e.key.length === 1) {
        t.classList.remove('input-ink');
        void (t as HTMLElement).offsetWidth;
        t.classList.add('input-ink');
      }
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('keydown', onKey, { passive: true });

    return () => {
      off();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[80]" aria-hidden="true" />
      <div ref={hostRef} className="fixed inset-0 pointer-events-none z-[90]" aria-hidden="true" />
    </>
  );
}