import React, { useState } from 'react';
import { Train, Plane } from 'lucide-react';
import TrajectorySVG from './TrajectorySVG';
import Seal from './Seal';
import type { Trip } from '../../../shared/types';

function formatDuration(minutes: number | null): string {
  if (!minutes) return '-';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m > 0 ? ' ' + m + 'm' : ''}` : `${m}m`;
}

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
  const isTrain = trip.type === 'train';
  const isHero = size === 'hero';

  const depName = trip.departureStation?.name || '?';
  const arrName = trip.arrivalStation?.name || '?';
  const depCode = trip.departureStation?.code || '';
  const arrCode = trip.arrivalStation?.code || '';

  const handleClick = () => { if (onClick) onClick(); };
  const handleMouseEnter = () => { if (isHero) setFlipped(true); };
  const handleMouseLeave = () => { if (isHero) setFlipped(false); };

  const barcode = (
    <svg width="100%" height={isHero ? 24 : 16} className="opacity-30">
      {Array.from({ length: 40 }).map((_, i) => {
        const bw = Math.random() > 0.5 ? 2 : 1;
        const x = i * 3;
        return Math.random() > 0.3 ? (
          <rect key={i} x={x} y={0} width={bw} height="100%" fill="rgb(var(--c-brand))" />
        ) : null;
      })}
    </svg>
  );

  const front = (
    <div
      className={`relative rounded-xl border border-brand/30 overflow-hidden cursor-pointer
        transition-shadow hover:shadow-lg ${isHero ? 'p-6' : 'p-4'} ${className}`}
      style={{
        background: 'linear-gradient(135deg, rgb(var(--c-brand-tint)) 0%, rgb(var(--c-surface-card)) 100%)',
      }}
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgb(var(--c-brand)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--c-brand)) 1px, transparent 1px)',
          backgroundSize: '8px 8px',
        }}
      />
      <div className="ticket-notch-left" style={{ top: '60%' }} />
      <div className="ticket-notch-right" style={{ top: '60%' }} />
      <div className="absolute left-4 right-4 border-t border-dashed border-brand/20" style={{ top: '60%' }} />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md flex items-center justify-center bg-brand/10">
              {isTrain
                ? <Train className="w-3.5 h-3.5 text-brand" />
                : <Plane className="w-3.5 h-3.5 text-brand" />}
            </div>
            <span className="font-mono text-sm font-semibold text-brand tracking-wide">
              {trip.trainFlightNumber}
            </span>
            <span className="text-xs text-content-secondary">{trip.operator}</span>
          </div>
          <Seal text={isTrain ? '\u94c1' : '\u4e91'} size={28} />
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className={`font-display font-bold text-content truncate ${isHero ? 'text-2xl' : 'text-lg'}`}>
              {depName}
            </p>
            {depCode && <p className="font-mono text-xs text-content-secondary mt-0.5">{depCode}</p>}
          </div>
          <div className="flex-shrink-0 text-content-tertiary">
            <svg width="32" height="12" viewBox="0 0 32 12">
              <line x1="0" y1="6" x2="28" y2="6" stroke="currentColor" strokeWidth="1" strokeDasharray="3 2" />
              <polygon points="28,2 32,6 28,10" fill="currentColor" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 text-right">
            <p className={`font-display font-bold text-content truncate ${isHero ? 'text-2xl' : 'text-lg'}`}>
              {arrName}
            </p>
            {arrCode && <p className="font-mono text-xs text-content-secondary mt-0.5">{arrCode}</p>}
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3 font-mono text-xs text-content-secondary">
          <span>{trip.departureDate}</span>
          <span className="text-brand font-medium">
            {trip.departureTime} \u2192 {trip.arrivalTime}
          </span>
          {trip.durationMinutes != null && <span>{formatDuration(trip.durationMinutes)}</span>}
          {trip.distanceKm != null && <span>{trip.distanceKm.toLocaleString()} km</span>}
        </div>
      </div>

      <div className="relative z-10 mt-4 pt-3">
        <div className="flex items-end justify-between">
          <div className="flex items-center gap-4 text-xs text-content-secondary">
            {trip.seatClass && <span>{trip.seatClass}</span>}
            {trip.seatNumber && <span className="font-mono">{trip.seatNumber}</span>}
            {trip.trainName && <span>{trip.trainName}</span>}
            {trip.vehicleType && <span className="font-mono">{trip.vehicleType}</span>}
          </div>
          {trip.cost != null && trip.currency && (
            <span className="font-mono text-sm font-semibold text-content">
              {trip.currency} {trip.cost.toLocaleString()}
            </span>
          )}
        </div>
        <div className="mt-2">{barcode}</div>
      </div>
    </div>
  );

  const back = (
    <div
      className="absolute inset-0 rounded-xl border border-brand/30 bg-surface-card p-6
        flex flex-col items-center justify-center"
      style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden' }}
    >
      <p className="text-xs text-content-secondary mb-3 font-mono uppercase tracking-wider">\u884c\u8ff9\u56fe</p>
      <TrajectorySVG width={240} height={80} distance={trip.distanceKm} />
      {trip.notes && (
        <p className="mt-4 text-sm text-content-secondary text-center max-w-xs font-display">
          {trip.notes}
        </p>
      )}
    </div>
  );

  if (isHero) {
    return (
      <div className="relative" style={{ perspective: '1000px' }}>
        <div
          className="relative"
          style={{
            transformStyle: 'preserve-3d',
            transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 600ms var(--ease-ink)',
          }}
        >
          {front}
          {back}
        </div>
      </div>
    );
  }

  return front;
}
