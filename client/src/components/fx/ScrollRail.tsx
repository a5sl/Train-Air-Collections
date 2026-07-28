import React from 'react';
import { Train } from 'lucide-react';
import { useScrollProgress } from '../../lib/motion';

/**
 * 右侧里程轨：随页面滚动行进的小火车 + 百分比读数。
 */
export default function ScrollRail() {
  const p = useScrollProgress();
  return (
    <div className="scroll-rail hidden lg:block" aria-hidden="true">
      <div className="rail-line" />
      <div className="rail-marker" style={{ top: 'calc(' + (p * 100).toFixed(1) + '% - 14px)' }}>
        <Train className="w-3.5 h-3.5 rotate-90" strokeWidth={2.4} />
      </div>
      <div className="rail-readout font-mono text-[10px] text-content-tertiary">
        {(p * 100).toFixed(0)}%
      </div>
    </div>
  );
}