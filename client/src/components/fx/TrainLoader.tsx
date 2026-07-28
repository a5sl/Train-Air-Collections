import React from 'react';
import { Train } from 'lucide-react';

/** 列车装载器：小火车沿铁轨往返。 */
export default function TrainLoader({ className = '' }: { className?: string }) {
  return (
    <div className={'train-loader ' + className} aria-label="加载中" role="status">
      <div className="rail-bed" />
      <div className="engine"><Train className="w-6 h-6" strokeWidth={2.2} /></div>
    </div>
  );
}