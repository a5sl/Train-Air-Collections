import React from 'react';
import { useScrollProgress } from '../../lib/motion';

/** 视差氛围背景：噪点、点阵、远山随滚动分层位移。 */
export function ParallaxBackdrop() {
  const p = useScrollProgress();
  return (
    <>
      <div className="ambient-noise" />
      <div className="ambient-grid" style={{ transform: 'translateY(' + (p * -30).toFixed(1) + 'px)' }} />
      <svg
        className="ambient-mountain"
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        style={{ transform: 'translateY(' + (p * 46).toFixed(1) + 'px)' }}
        aria-hidden="true"
      >
        <path
          d="M0,120 L0,80 Q120,40 240,70 Q360,100 480,60 Q600,20 720,50 Q840,80 960,40 Q1080,10 1200,55 Q1320,90 1440,60 L1440,120 Z"
          fill="rgb(var(--c-content))"
        />
      </svg>
    </>
  );
}

/** 顶栏里程进度线。 */
export function HeaderProgress() {
  const p = useScrollProgress();
  return <div className="header-progress" style={{ width: (p * 100).toFixed(1) + '%' }} />;
}