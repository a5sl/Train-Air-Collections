import React from 'react';
import SplitFlap from './fx/SplitFlap';

export default function TelemetryPanel({
  label,
  labelEn,
  value,
  unit,
  icon: Icon,
  format,
  className = '',
}: {
  label: string;
  labelEn?: string;
  value: number;
  unit?: string;
  icon?: React.ComponentType<{ className?: string }>;
  format?: (n: number) => string;
  className?: string;
}) {
  return (
    <div className={'screen-panel ' + className}>
      <div className="absolute left-3 top-4 bottom-4 flex flex-col justify-between">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="w-2 h-px bg-brand/40" />
        ))}
      </div>
      <div className="pl-5">
        <div className="flex items-center gap-2 mb-1.5">
          {Icon && <Icon className="w-3.5 h-3.5 text-screendata/60" />}
          <span className="text-xs text-screentext/60 font-medium">{label}</span>
          {labelEn && (
            <span className="text-[10px] text-screentext/30 font-mono uppercase tracking-wider">{labelEn}</span>
          )}
        </div>
        <div className="flex items-baseline gap-1.5">
          <SplitFlap
            value={value}
            format={format}
            className="text-2xl font-bold font-mono text-screendata tracking-tight"
          />
          {unit && (
            <span className="text-sm font-mono text-screendata/60">{unit}</span>
          )}
        </div>
      </div>
    </div>
  );
}