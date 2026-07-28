import React from 'react';

export default function Seal({
  text,
  size = 48,
  color,
  className = '',
  animated = false,
}: {
  text: string;
  size?: number;
  color?: string;
  className?: string;
  animated?: boolean;
}) {
  const c = color || 'rgb(var(--c-brand))';
  const fontSize = size * 0.4;
  const ringWidth = Math.max(2, size * 0.06);

  return (
    <div
      className={`inline-flex items-center justify-center ${animated ? 'animate-stamp-in' : ''} ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - ringWidth}
          fill="none"
          stroke={c}
          strokeWidth={ringWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={size / 2 - ringWidth * 2.5}
          fill="none"
          stroke={c}
          strokeWidth={1}
          opacity={0.4}
        />
        <text
          x={size / 2}
          y={size / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fill={c}
          fontSize={fontSize}
          fontFamily='"Noto Serif SC", "Songti SC", serif'
          fontWeight={700}
        >
          {text}
        </text>
      </svg>
    </div>
  );
}
