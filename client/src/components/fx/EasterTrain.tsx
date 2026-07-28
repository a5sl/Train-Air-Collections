import React, { useEffect, useState } from 'react';

/**
 * 彩蛋列车：连续敲出 G1 时，一列小火车沿屏幕底部飞驰而过。
 */
export default function EasterTrain({ runId }: { runId: number }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (runId === 0) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3200);
    return () => clearTimeout(t);
  }, [runId]);

  if (!visible) return null;

  return (
    <div className="easter-train" aria-hidden="true">
      <span className="easter-smoke" style={{ left: 6, top: -6, width: 10, height: 10, animationDelay: '0s' }} />
      <span className="easter-smoke" style={{ left: 2, top: -2, width: 8, height: 8, animationDelay: '0.25s' }} />
      <span className="easter-smoke" style={{ left: 10, top: -4, width: 7, height: 7, animationDelay: '0.5s' }} />
      <svg width="190" height="46" viewBox="0 0 190 46">
        {/* 机车 */}
        <rect x="4" y="10" width="52" height="22" rx="4" fill="rgb(var(--c-brand))" />
        <rect x="46" y="4" width="14" height="10" rx="2" fill="rgb(var(--c-brand))" />
        <rect x="10" y="15" width="10" height="8" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <rect x="24" y="15" width="10" height="8" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <circle cx="16" cy="36" r="5" fill="rgb(var(--c-content))" />
        <circle cx="40" cy="36" r="5" fill="rgb(var(--c-content))" />
        {/* 车厢一 */}
        <rect x="64" y="12" width="52" height="20" rx="3" fill="rgb(var(--c-accent))" />
        <rect x="70" y="16" width="8" height="7" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <rect x="82" y="16" width="8" height="7" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <rect x="94" y="16" width="8" height="7" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <circle cx="76" cy="36" r="4.5" fill="rgb(var(--c-content))" />
        <circle cx="102" cy="36" r="4.5" fill="rgb(var(--c-content))" />
        {/* 车厢二 */}
        <rect x="124" y="12" width="52" height="20" rx="3" fill="rgb(var(--c-accent))" opacity="0.8" />
        <rect x="130" y="16" width="8" height="7" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <rect x="142" y="16" width="8" height="7" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <rect x="154" y="16" width="8" height="7" rx="1.5" fill="rgb(var(--c-surface-card))" />
        <circle cx="136" cy="36" r="4.5" fill="rgb(var(--c-content))" />
        <circle cx="162" cy="36" r="4.5" fill="rgb(var(--c-content))" />
        {/* 轨 */}
        <line x1="0" y1="42" x2="190" y2="42" stroke="rgb(var(--c-line))" strokeWidth="2" strokeDasharray="6 4" />
        <text x="30" y="27" textAnchor="middle" fontSize="7" fontFamily="var(--font-mono)" fill="rgb(var(--c-surface-card))" fontWeight="700">G1</text>
      </svg>
    </div>
  );
}