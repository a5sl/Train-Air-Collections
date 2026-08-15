import React, { useEffect, useMemo, useRef, useState } from 'react';
import { prefersReducedMotion } from '../lib/motion';

type LatLng = { lat: number | null; lng: number | null };

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** 大圆航线采样（球面插值），返回 [lat, lng] 序列；共点或对跖点时返回 null。 */
function sampleGreatCircle(lat1: number, lng1: number, lat2: number, lng2: number, n = 48): [number, number][] | null {
  const p1 = [Math.cos(toRad(lat1)) * Math.cos(toRad(lng1)), Math.cos(toRad(lat1)) * Math.sin(toRad(lng1)), Math.sin(toRad(lat1))];
  const p2 = [Math.cos(toRad(lat2)) * Math.cos(toRad(lng2)), Math.cos(toRad(lat2)) * Math.sin(toRad(lng2)), Math.sin(toRad(lat2))];
  const dot = Math.max(-1, Math.min(1, p1[0] * p2[0] + p1[1] * p2[1] + p1[2] * p2[2]));
  const theta = Math.acos(dot);
  if (Math.abs(theta) < 1e-6 || Math.abs(theta - Math.PI) < 1e-6) return null;
  const sinTheta = Math.sin(theta);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = Math.sin((1 - t) * theta) / sinTheta;
    const b = Math.sin(t * theta) / sinTheta;
    const x = a * p1[0] + b * p2[0];
    const y = a * p1[1] + b * p2[1];
    const z = a * p1[2] + b * p2[2];
    pts.push([toDeg(Math.asin(Math.max(-1, Math.min(1, z)))), toDeg(Math.atan2(y, x))]);
  }
  return pts;
}

export default function TrajectorySVG({
  width = 240,
  height = 64,
  color,
  distance,
  className = '',
  dep,
  arr,
  depCode,
  arrCode,
}: {
  width?: number;
  height?: number;
  color?: string;
  distance?: number | null;
  className?: string;
  dep?: LatLng;
  arr?: LatLng;
  depCode?: string | null;
  arrCode?: string | null;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const c = color || 'rgb(var(--c-brand))';
  const pad = 16;
  const midY = height / 2;
  const cpY = midY - height * 0.35;

  const hasCoords =
    dep?.lat != null && dep?.lng != null && arr?.lat != null && arr?.lng != null;

  /** 真实地理投影：经纬网格 + 大圆航线路径；坐标缺失时返回 null 走抽象弧线回退。 */
  const map = useMemo(() => {
    if (!hasCoords || !dep || !arr) return null;
    const raw = sampleGreatCircle(dep.lat!, dep.lng!, arr.lat!, arr.lng!);
    if (!raw) return null;

    // 经度连续展开（跨 ±180° 时自动延伸，保证路径不断开）
    const pts: [number, number][] = [];
    for (let i = 0; i < raw.length; i++) {
      const [lat, lng] = raw[i];
      if (i === 0) {
        pts.push([lat, lng]);
        continue;
      }
      let cur = lng;
      const prev = pts[i - 1][1];
      while (cur - prev > 180) cur -= 360;
      while (cur - prev < -180) cur += 360;
      pts.push([lat, cur]);
    }

    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lat, lng] of pts) {
      minLon = Math.min(minLon, lng);
      maxLon = Math.max(maxLon, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    // 单一经度/纬度的退化场景：人工扩出 1° 视野
    if (maxLon - minLon < 1e-9) { minLon -= 0.5; maxLon += 0.5; }
    if (maxLat - minLat < 1e-9) { minLat -= 0.5; maxLat += 0.5; }

    const lonSpan = maxLon - minLon;
    const latPad = Math.max((maxLat - minLat) * 0.3, 4);
    const top = maxLat + latPad;
    const bottom = minLat - latPad;

    const x = (lng: number) => pad + ((lng - minLon) / lonSpan) * (width - 2 * pad);
    const y = (lat: number) => pad + ((top - lat) / (top - bottom)) * (height - 2 * pad);
    const proj = pts.map(([lat, lng]) => [x(lng), y(lat)] as [number, number]);

    // 经纬网格：4 段经线、3 段纬线
    const meridians = Array.from({ length: 3 }, (_, i) => x(minLon + ((i + 1) / 4) * lonSpan));
    const parallels = Array.from({ length: 2 }, (_, i) => y(bottom + ((i + 1) / 3) * (top - bottom)));

    return { proj, meridians, parallels, mid: proj[Math.floor(proj.length / 2)] };
  }, [hasCoords, dep, arr, width, height]);

  /** 罗盘玫瑰放在离路线所有采样点最远的顶角，避免遮挡路径 */
  const compass = useMemo(() => {
    if (!map) return null;
    const corners: [number, number][] = [
      [18, 18],
      [width - 18, 18],
    ];
    let best = corners[0];
    let bestD = -1;
    for (const [cx, cy] of corners) {
      let minD = Infinity;
      for (const [px, py] of map.proj) {
        const d = (cx - px) ** 2 + (cy - py) ** 2;
        if (d < minD) minD = d;
      }
      if (minD > bestD) { bestD = minD; best = [cx, cy]; }
    }
    return best;
  }, [map, width, height]);

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

  // 路径描边动画：先量出真实长度作 dashoffset，再过渡到 0（结束后恢复虚线样式）
  useEffect(() => {
    const el = pathRef.current;
    if (!el || !visible) return;
    if (prefersReducedMotion()) return;
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    el.getBoundingClientRect();
    el.style.transition = `stroke-dashoffset calc(0.9s / var(--motion-speed)) var(--ease-ink)`;
    el.style.strokeDashoffset = '0';
  }, [visible]);

  const resetDash = () => {
    const el = pathRef.current;
    if (!el) return;
    el.style.transition = 'none';
    el.style.strokeDasharray = '5 4';
    el.style.strokeDashoffset = '0';
  };

  /** 坐标格式化：N31° E121° 风格 */
  const fmtLat = (lat: number) => `${Math.abs(Math.round(lat))}°${lat >= 0 ? 'N' : 'S'}`;
  const fmtLon = (lng: number) => `${Math.abs(Math.round(lng))}°${lng >= 0 ? 'E' : 'W'}`;

  const MONO = '"IBM Plex Mono", monospace';

  /** 起终点标记 + 代码 */
  const Endpoint = ({ px, py, code }: { px: number; py: number; code?: string | null }) => {
    const leftHalf = px < width / 2;
    const tx = Math.max(9, Math.min(width - 9, leftHalf ? px + 7 : px - 7));
    const ty = py > height - 30 ? py - 8 : py + 12;
    return (
      <g>
        <circle cx={px} cy={py} r={4} fill="none" stroke={c} strokeWidth={1.2} opacity={0.9} />
        <circle cx={px} cy={py} r={1.6} fill={c} />
        {code && (
          <text x={tx} y={ty} textAnchor={leftHalf ? 'start' : 'end'} fontSize={8} fill={c} opacity={0.85} fontFamily={MONO}>
            {code}
          </text>
        )}
      </g>
    );
  };

  /** 复古罗盘玫瑰（紧凑型，仅 N 定向标记） */
  const CompassRose = ({ cx, cy }: { cx: number; cy: number }) => (
    <g transform={`translate(${cx}, ${cy})`} opacity={0.5}>
      <line x1={0} y1={-9} x2={0} y2={9} stroke={c} strokeWidth={1} />
      <line x1={-9} y1={0} x2={9} y2={0} stroke={c} strokeWidth={1} />
      <line x1={-6} y1={-6} x2={6} y2={6} stroke={c} strokeWidth={0.6} />
      <line x1={6} y1={-6} x2={-6} y2={6} stroke={c} strokeWidth={0.6} />
      <circle r={1.8} fill={c} />
      <text x={0} y={-15} textAnchor="middle" fontSize={6.5} fill={c} fontFamily={MONO}>N</text>
    </g>
  );

  const fallbackPath = `M ${pad} ${midY} Q ${width / 2} ${cpY} ${width - pad} ${midY}`;

  return (
    <div ref={containerRef} className={className}>
      <svg width={width} height={height} className="overflow-visible">
        {map ? (
          <>
            {/* 地图框线 + 四角装饰 */}
            <rect x={1} y={1} width={width - 2} height={height - 2} rx={4} fill="none" stroke={c} strokeWidth={1} opacity={0.3} />
            {[
              `M 8 1.5 L 1.5 1.5 L 1.5 8`,
              `M ${width - 8} 1.5 L ${width - 1.5} 1.5 L ${width - 1.5} 8`,
              `M 8 ${height - 1.5} L 1.5 ${height - 1.5} L 1.5 ${height - 8}`,
              `M ${width - 8} ${height - 1.5} L ${width - 1.5} ${height - 1.5} L ${width - 1.5} ${height - 8}`,
            ].map((d) => (
              <path key={d} d={d} fill="none" stroke={c} strokeWidth={1.5} opacity={0.55} />
            ))}

            {/* 经纬网格 */}
            {map.meridians.map((mx, i) => (
              <line key={`m${i}`} x1={mx} y1={pad} x2={mx} y2={height - pad} stroke={c} strokeWidth={0.7} opacity={0.17} />
            ))}
            {map.parallels.map((py, i) => (
              <line key={`p${i}`} x1={pad} y1={py} x2={width - pad} y2={py} stroke={c} strokeWidth={0.7} opacity={0.17} />
            ))}

            {/* 路线 */}
            <path
              ref={pathRef}
              d={map.proj.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')}
              fill="none"
              stroke={c}
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="5 4"
              opacity={0.85}
              onTransitionEnd={resetDash}
            />

            <Endpoint px={map.proj[0][0]} py={map.proj[0][1]} code={depCode} />
            <Endpoint px={map.proj[map.proj.length - 1][0]} py={map.proj[map.proj.length - 1][1]} code={arrCode} />

            {/* 罗盘玫瑰 + 起终点坐标 */}
            {compass && <CompassRose cx={compass[0]} cy={compass[1]} />}
            <text x={10} y={height - 7} fontSize={7} fill={c} opacity={0.6} fontFamily={MONO}>
              {fmtLat(dep!.lat!)} {fmtLon(dep!.lng!)}
            </text>
            <text x={width - 10} y={height - 7} textAnchor="end" fontSize={7} fill={c} opacity={0.6} fontFamily={MONO}>
              {fmtLat(arr!.lat!)} {fmtLon(arr!.lng!)}
            </text>

            {/* 距离徽章 */}
            {distance != null && distance > 0 && (
              (() => {
                const label = `${distance.toLocaleString()} km`;
                const pillW = label.length * 5.2 + 12;
                const pillH = 14;
                const px = Math.max(pillW / 2 + 4, Math.min(width - pillW / 2 - 4, map.mid[0]));
                const py = Math.max(4, map.mid[1] - pillH - 5);
                return (
                  <g>
                    <rect x={px - pillW / 2} y={py} width={pillW} height={pillH} rx={pillH / 2} fill="rgb(var(--c-surface-card))" stroke={c} strokeWidth={0.6} opacity={0.92} />
                    <text x={px} y={py + pillH / 2 + 3} textAnchor="middle" fontSize={8.5} fill={c} opacity={0.9} fontFamily={MONO}>
                      {label}
                    </text>
                  </g>
                );
              })()
            )}
          </>
        ) : (
          <>
            <path
              ref={pathRef}
              d={fallbackPath}
              fill="none"
              stroke={c}
              strokeWidth={2}
              strokeDasharray="6 4"
              opacity={0.7}
              onTransitionEnd={resetDash}
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
                fontFamily={MONO}
                opacity={0.8}
              >
                {distance.toLocaleString()} km
              </text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}