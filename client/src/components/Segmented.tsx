import React from 'react';

interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export default function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`relative inline-flex rounded-lg border border-line bg-surface p-1 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-300 ${
              active ? 'text-white' : 'text-content-secondary hover:text-content'
            }`}
          >
            {active && (
              <span
                className="absolute inset-0 rounded-md bg-brand transition-all duration-300"
                style={{ transitionTimingFunction: 'var(--ease-ink)' }}
              />
            )}
            {Icon && <Icon className="w-3.5 h-3.5 relative z-10" />}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
