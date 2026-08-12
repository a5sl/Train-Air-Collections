import React, { useMemo, useState } from 'react';
import { Train, Plane } from 'lucide-react';
import TrajectorySVG from './TrajectorySVG';
import Seal from './Seal';
import AirlineLogo from './AirlineLogo';
import { prefersReducedMotion, isCoarsePointer } from '../lib/motion';
import type { Trip } from '../../../shared/types';

/* ---------------- 工具 ---------------- */

function formatDuration(minutes: number | null): string {
  if (!minutes) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ' ' + m + 'm' : ''}` : `${m}m`;
}

/** 确定性伪随机（mulberry32）：条码按 trip.id 播种，渲染间不再抖动。 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useBarcodeBars(seed: number, count = 44) {
  return useMemo(() => {
    const rnd = mulberry32((seed + 1) * 2654435761);
    const bars: { pos: number; w: number }[] = [];
    let pos = 0;
    for (let i = 0; i < count; i++) {
      const w = rnd() > 0.55 ? 2.4 : 1.2;
      bars.push({ pos, w });
      pos += w + (rnd() > 0.7 ? 2.6 : 1.4);
    }
    return { bars, span: pos };
  }, [seed, count]);
}

/** 横向条码 */
function Barcode({ seed, height = 16, className = '' }: { seed: number; height?: number; className?: string }) {
  const { bars, span } = useBarcodeBars(seed);
  return (
    <svg viewBox={`0 0 ${span} 20`} preserveAspectRatio="none" className={className} style={{ width: '100%', height }} aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={b.pos} y={0} width={b.w} height={20} fill="rgb(var(--c-content) / 0.62)" />
      ))}
    </svg>
  );
}

/** 纵向条码（登机牌撕角用） */
function VBarcode({ seed, width = 18, className = '' }: { seed: number; width?: number; className?: string }) {
  const { bars, span } = useBarcodeBars(seed, 26);
  return (
    <svg viewBox={`0 0 20 ${span}`} preserveAspectRatio="none" className={className} style={{ width, height: '100%' }} aria-hidden="true">
      {bars.map((b, i) => (
        <rect key={i} x={0} y={b.pos} width={20} height={b.w} fill="rgb(var(--c-content) / 0.62)" />
      ))}
    </svg>
  );
}

/** 票面字段小格 */
function Field({ zh, en, value, accent }: { zh: string; en: string; value?: string | null; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] font-mono uppercase tracking-[0.16em] text-content-tertiary whitespace-nowrap">
        {en}
        <span className="ml-1 font-sans tracking-normal">{zh}</span>
      </p>
      <p className="font-mono text-sm font-semibold text-content truncate" style={accent ? { color: 'rgb(var(--c-brand-deep))' } : undefined}>
        {value || '—'}
      </p>
    </div>
  );
}

/** 纸纹网格底 */
function PaperGrid() {
  return (
    <div
      className="absolute inset-0 pointer-events-none opacity-[0.04]"
      style={{
        backgroundImage:
          'linear-gradient(rgb(var(--c-brand)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-brand)) 1px, transparent 1px)',
        backgroundSize: '8px 8px',
      }}
    />
  );
}

const FACE_BG = 'linear-gradient(135deg, rgb(var(--c-brand-tint)) 0%, rgb(var(--c-surface-card)) 60%)';

/* ---------------- 火车票票面 ---------------- */

function TrainFace({ trip, isHero, className }: { trip: Trip; isHero: boolean; className: string }) {
  const accent = 'rgb(var(--c-train-line))';
  const depName = trip.departureStation?.name || '?';
  const arrName = trip.arrivalStation?.name || '?';
  const depCode = (trip.departureStation?.code || '').split('|')[0];
  const arrCode = (trip.arrivalStation?.code || '').split('|')[0];

  return (
    <div
      className={`relative rounded-xl border border-brand/30 overflow-hidden transition-shadow hover:shadow-lg ${isHero ? 'p-6 pl-7' : 'p-4 pl-5'} ${className}`}
      style={{ background: FACE_BG }}
    >
      <span className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} aria-hidden="true" />
      <PaperGrid />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="font-mono text-sm font-bold px-2 py-0.5 rounded border tracking-wide flex-shrink-0"
              style={{ color: accent, borderColor: 'rgb(var(--c-train-line) / 0.45)', background: 'rgb(var(--c-train-line) / 0.1)' }}
            >
              {trip.trainFlightNumber}
            </span>
            <span className="text-xs text-content-secondary truncate">{trip.operator}</span>
            {(trip.trainName || trip.vehicleType) && (
              <span className="hidden sm:inline text-[10px] font-mono text-content-tertiary truncate">
                {[trip.trainName, trip.vehicleType].filter(Boolean).join(' · ')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-[9px] font-mono tracking-[0.2em] text-content-tertiary">
              NO.{String(trip.id).padStart(6, '0')}
            </span>
            <Seal text="铁" size={isHero ? 30 : 24} color={accent} />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className={`font-display font-bold text-content truncate ${isHero ? 'text-3xl' : 'text-lg'}`}>{depName}</p>
            {depCode && <p className="font-mono text-xs text-content-secondary mt-0.5">{depCode}</p>}
          </div>
          <div className="flex-shrink-0 flex flex-col items-center px-1" style={{ color: accent }}>
            <Train className={`${isHero ? 'w-4 h-4' : 'w-3.5 h-3.5'} mb-1 opacity-80`} />
            <svg width={isHero ? 92 : 64} height="10" viewBox="0 0 92 10" preserveAspectRatio="none">
              <line x1="0" y1="5" x2="80" y2="5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 3" />
              <polygon points="80,1 92,5 80,9" fill="currentColor" />
            </svg>
            {isHero && <span className="text-[9px] font-mono mt-0.5 opacity-70">{formatDuration(trip.durationMinutes)}</span>}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className={`font-display font-bold text-content truncate ${isHero ? 'text-3xl' : 'text-lg'}`}>{arrName}</p>
            {arrCode && <p className="font-mono text-xs text-content-secondary mt-0.5">{arrCode}</p>}
          </div>
        </div>

        {isHero && (
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-x-3 gap-y-2 mt-4">
            <Field zh="日期" en="DATE" value={trip.departureDate} />
            <Field zh="发车" en="DEPART" value={trip.departureTime} accent />
            <Field zh="到达" en="ARRIVE" value={trip.arrivalTime} />
            <Field zh="席别" en="CLASS" value={trip.seatClass} />
            <Field zh="车厢" en="CAR" value={trip.carriageNumber} />
            <Field zh="座位" en="SEAT" value={trip.seatNumber} />
          </div>
        )}
      </div>

      <div className="relative z-10 mt-4 pt-3 border-t border-dashed border-brand/25">
        <div className="ticket-notch-left" style={{ top: -8 }} />
        <div className="ticket-notch-right" style={{ top: -8 }} />
        <div className="flex items-end gap-4">
          <div className="flex-shrink-0">
            {trip.cost != null && trip.currency ? (
              <p className="font-mono text-sm font-semibold text-content whitespace-nowrap">
                {trip.currency} {trip.cost.toLocaleString()}
              </p>
            ) : (
              <p className="font-mono text-sm text-content-tertiary">—</p>
            )}
            {trip.distanceKm != null && (
              <p className="font-mono text-[10px] text-content-tertiary mt-0.5">{trip.distanceKm.toLocaleString()} km</p>
            )}
          </div>
          <Barcode seed={trip.id} height={isHero ? 22 : 14} className="flex-1 min-w-0" />
        </div>
        {!isHero && (
          <p className="font-mono text-[10px] text-content-secondary mt-2 truncate">
            {trip.departureDate} {trip.departureTime}
            {trip.seatClass ? ' · ' + trip.seatClass : ''}
            {trip.seatNumber ? ' · ' + trip.seatNumber : ''}
          </p>
        )}
      </div>
    </div>
  );
}

/* ---------------- 登机牌票面 ---------------- */

function FlightFace({ trip, isHero, className }: { trip: Trip; isHero: boolean; className: string }) {
  const accent = 'rgb(var(--c-flight-line))';
  const depName = trip.departureStation?.name || '?';
  const arrName = trip.arrivalStation?.name || '?';
  const depCode = (trip.departureStation?.code || '').split('|')[0] || depName.slice(0, 3);
  const arrCode = (trip.arrivalStation?.code || '').split('|')[0] || arrName.slice(0, 3);

  return (
    <div
      className={`relative rounded-xl border border-brand/30 overflow-hidden transition-shadow hover:shadow-lg flex ${className}`}
      style={{ background: FACE_BG }}
    >
      <PaperGrid />

      <div className={`relative z-10 flex-1 min-w-0 ${isHero ? 'p-6' : 'p-4'}`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <AirlineLogo flightNumber={trip.trainFlightNumber} operator={trip.operator} size={isHero ? 28 : 20} />
            <span
              className="font-mono text-sm font-bold px-2 py-0.5 rounded border tracking-wide flex-shrink-0"
              style={{ color: accent, borderColor: 'rgb(var(--c-flight-line) / 0.45)', background: 'rgb(var(--c-flight-line) / 0.1)' }}
            >
              {trip.trainFlightNumber}
            </span>
            <span className="text-xs text-content-secondary truncate">{trip.operator}</span>
            {isHero && trip.vehicleType && (
              <span className="hidden sm:inline text-[10px] font-mono text-content-tertiary">{trip.vehicleType}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden sm:inline text-[9px] font-mono uppercase tracking-[0.2em] text-content-tertiary">Boarding Pass</span>
            <Seal text="云" size={isHero ? 30 : 24} color={accent} />
          </div>
        </div>

        {trip.isCodeshare && trip.operatingCarrier && (
          <div className="mb-2">
            <span className="text-[10px] font-mono text-content-tertiary">
              实际执飞: {trip.operatingCarrier}
              {trip.operatingFlightNumber ? ` ${trip.operatingFlightNumber}` : ""}
            </span>
          </div>
        )}


        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className={`font-mono font-bold tracking-tight text-content ${isHero ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{depCode}</p>
            <p className={`text-content-secondary truncate ${isHero ? 'text-xs mt-1' : 'text-[10px] mt-0.5'}`}>{depName}</p>
          </div>
          <div className="flex-shrink-0 flex flex-col items-center px-1" style={{ color: accent }}>
            <Plane className={`${isHero ? 'w-4 h-4' : 'w-3.5 h-3.5'} mb-1 opacity-80`} />
            <svg width={isHero ? 92 : 56} height="10" viewBox="0 0 92 10" preserveAspectRatio="none">
              <line x1="0" y1="5" x2="80" y2="5" stroke="currentColor" strokeWidth="1.2" strokeDasharray="4 3" />
              <polygon points="80,1 92,5 80,9" fill="currentColor" />
            </svg>
            {isHero && <span className="text-[9px] font-mono mt-0.5 opacity-70">{formatDuration(trip.durationMinutes)}</span>}
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className={`font-mono font-bold tracking-tight text-content ${isHero ? 'text-2xl sm:text-4xl' : 'text-xl sm:text-2xl'}`}>{arrCode}</p>
            <p className={`text-content-secondary truncate ${isHero ? 'text-xs mt-1' : 'text-[10px] mt-0.5'}`}>{arrName}</p>
          </div>
        </div>

        {isHero && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-3 gap-y-2 mt-4">
            <Field zh="日期" en="DATE" value={trip.departureDate} />
            <Field zh="起飞" en="DEPART" value={trip.departureTime} accent />
            <Field zh="到达" en="ARRIVE" value={trip.arrivalTime} />
            <Field zh="舱位" en="CLASS" value={trip.seatClass} />
            <Field zh="机型" en="AIRCRAFT" value={trip.vehicleType} />
          </div>
        )}
        {!isHero && (
          <p className="font-mono text-[10px] text-content-secondary mt-2 truncate">
            {trip.departureDate} {trip.departureTime}
            {trip.seatClass ? ' · ' + trip.seatClass : ''}
          </p>
        )}
      </div>

      <div className="relative border-l border-dashed border-brand/25">
        <span className="absolute -left-2 -top-2 w-4 h-4 rounded-full" style={{ background: 'rgb(var(--c-surface))' }} aria-hidden="true" />
        <span className="absolute -left-2 -bottom-2 w-4 h-4 rounded-full" style={{ background: 'rgb(var(--c-surface))' }} aria-hidden="true" />
      </div>
      <div
        className="relative z-10 flex flex-col items-center justify-between gap-2 flex-shrink-0"
        style={{ background: 'rgb(var(--c-flight-line) / 0.07)', width: isHero ? undefined : 72, minWidth: isHero ? 80 : 72, maxWidth: isHero ? '27%' : undefined, padding: isHero ? '1.25rem 0.75rem' : '0.75rem 0.5rem' }}
      >
        <p className="font-mono text-[10px] font-semibold tracking-wider" style={{ color: accent }}>
          {trip.trainFlightNumber}
        </p>
        <div className="text-center">
          <p className="text-[8px] font-mono uppercase tracking-[0.18em] text-content-tertiary">Seat 座位</p>
          <p className={`font-mono font-bold text-content ${isHero ? 'text-2xl' : 'text-base'}`}>{trip.seatNumber || '—'}</p>
          {isHero && trip.seatClass && <p className="text-[10px] font-mono text-content-secondary mt-0.5">{trip.seatClass}</p>}
        </div>
        <VBarcode seed={trip.id + 7} width={isHero ? 18 : 12} className={isHero ? 'flex-1 max-h-24' : 'flex-1 max-h-14'} />
      </div>
    </div>
  );
}

/* ---------------- 背面：行迹图 ---------------- */

function TicketBack({ trip }: { trip: Trip }) {
  const isTrain = trip.type === 'train';
  return (
    <div
      className="absolute inset-0 rounded-xl border border-brand/30 bg-surface-card p-6 flex flex-col items-center justify-center"
      style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
    >
      <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-content-tertiary mb-3">
        行迹图 · {isTrain ? 'RAIL ROUTE' : 'FLIGHT ROUTE'}
      </p>
      <TrajectorySVG width={240} height={80} distance={trip.distanceKm} color={isTrain ? 'rgb(var(--c-train-line))' : 'rgb(var(--c-flight-line))'} />
      {trip.notes && (
        <p className="mt-4 text-sm text-content-secondary text-center max-w-xs font-display">{trip.notes}</p>
      )}
    </div>
  );
}

/* ---------------- 主组件 ---------------- */

export default function Ticket({
  trip,
  size = 'normal',
  onClick,
  className = '',
}: {
  trip: Trip;
  size?: 'normal' | 'hero';
  onClick?: () => void;
  className?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const isHero = size === 'hero';
  const isTrain = trip.type === 'train';

  const depName = trip.departureStation?.name || '?';
  const arrName = trip.arrivalStation?.name || '?';

  const hoverFlip = isHero && !prefersReducedMotion() && !isCoarsePointer();

  const front = isTrain ? (
    <TrainFace trip={trip} isHero={isHero} className={className} />
  ) : (
    <FlightFace trip={trip} isHero={isHero} className={className} />
  );

  if (!isHero) {
    return (
      <div
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
        className={onClick ? 'cursor-pointer' : ''}
      >
        {front}
      </div>
    );
  }

  return (
    <div
      className="relative cursor-pointer select-none transition-transform duration-300 hover:-translate-y-1 focus-visible:outline-none"
      style={{ perspective: '1200px' }}
      onMouseEnter={() => hoverFlip && setFlipped(true)}
      onMouseLeave={() => hoverFlip && setFlipped(false)}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      aria-label={`${isTrain ? '火车票' : '登机牌'}：${depName} 至 ${arrName}，回车查看详情`}
    >
      <div
        className="relative"
        style={{
          transformStyle: 'preserve-3d',
          transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          transition: prefersReducedMotion() ? 'none' : 'transform calc(0.7s / var(--motion-speed)) var(--ease-stamp)',
        }}
      >
        <div style={{ backfaceVisibility: 'hidden' }}>{front}</div>
        <TicketBack trip={trip} />
      </div>
    </div>
  );
}