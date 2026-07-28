import React, { useEffect, useRef, useState } from 'react';

export default function TrajectorySVG({
  width = 200,
  height = 60,
  color,
  distance,
  className = '',
}: {
  width?: number;
  height?: number;
  color?: string;
  distance?: number | null;
  className?: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const c = color || 'rgb(var(--c-brand))';
  const pad = 16;
  const midY = height / 2;
  const cpY = midY - height * 0.35;
  const d = `M ${pad} ${midY} Q ${width / 2} ${cpY} ${width - pad} ${midY}`;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        obs.unobserve(el);
      }
    }, { threshold: 0.3 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={containerRef} className={className}>
      <svg width={width} height={height} className="overflow-visible">
        <path
          ref={pathRef}
          d={d}
          fill="none"
          stroke={c}
          strokeWidth={2}
          strokeDasharray="6 4"
          opacity={0.7}
          className={visible ? 'trajectory-path animate' : 'trajectory-path'}
        />
        <g transform={`translate(${pad}, ${midY})`}>
          <line x1={-5} y1={0} x2={5} y2={0} stroke={c} strokeWidth={1.5} />
          <line x1={0} y1={-5} x2={0} y2={5} stroke={c} strokeWidth={1.5} />
          <circle r={2} fill={c} />
        </g>
        <g transform={`translate(${width - pad}, ${midY})`}>
          <line x1={-5} y1={0} x2={5} y2={0} stroke={c} strokeWidth={1.5} />
          <line x1={0} y1={-5} x2={0} y2={5} stroke={c} strokeWidth={1.5} />
          <circle r={2} fill={c} />
        </g>
        {distance != null && distance > 0 && (
          <text
            x={width / 2}
            y={cpY - 4}
            textAnchor="middle"
            fill={c}
            fontSize={10}
            fontFamily='"IBM Plex Mono", monospace'
            opacity={0.8}
          >
            {distance.toLocaleString()} km
          </text>
        )}
      </svg>
    </div>
  );
}
