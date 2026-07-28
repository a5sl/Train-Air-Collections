import React from 'react';

function Cloud({ top, width, duration, delay }: { top: string; width: number; duration: number; delay: number }) {
  return (
    <svg
      className="ambient-cloud"
      style={{ top, width, animationDuration: duration + 's', animationDelay: delay + 's' }}
      viewBox="0 0 120 40"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M14 34 Q4 34 4 26 Q4 18 13 18 Q15 8 26 8 Q34 2 43 8 Q52 4 58 12 Q70 10 72 20 Q82 20 82 28 Q82 34 74 34 Z" />
    </svg>
  );
}

/**
 * 活体背景：缓移云层 + 偶尔掠过的小飞机。
 */
export default function AmbientLife() {
  return (
    <>
      <Cloud top="9%" width={150} duration={150} delay={-30} />
      <Cloud top="18%" width={100} duration={190} delay={-110} />
      <Cloud top="4%" width={80} duration={120} delay={-70} />
      <svg className="ambient-plane" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M2 12 L22 3 L15 21 L11 13 Z" strokeLinejoin="round" />
      </svg>
    </>
  );
}