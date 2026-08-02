import { useState } from 'react';
import { extractIataCode, monogramColor } from '../lib/airline';

/**
 * Airline logo with graceful degradation:
 * self-hosted /api/airlines/logo/{CODE} image -> monogram badge fallback.
 */
export default function AirlineLogo({
  flightNumber,
  operator,
  size = 20,
  className = '',
}: {
  flightNumber: string;
  operator?: string;
  size?: number;
  className?: string;
}) {
  const code = extractIataCode(flightNumber);
  const [failed, setFailed] = useState(false);

  if (!code || failed) {
    const label =
      (code || operator || '?')
        .replace(/[^\p{L}\p{N}]/gu, '')
        .slice(0, 2)
        .toUpperCase() || '?';
    return (
      <span
        className={'inline-flex items-center justify-center rounded-md font-mono font-bold text-white flex-shrink-0 select-none ' + className}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.42), lineHeight: 1, background: monogramColor(code || label) }}
        aria-hidden="true"
      >
        {label}
      </span>
    );
  }

  return (
    <img
      src={'/api/airlines/logo/' + code}
      alt={operator || code}
      title={operator || code}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className={'rounded-md bg-surface-card ring-1 ring-line-subtle object-contain flex-shrink-0 ' + className}
      style={{ padding: Math.max(2, Math.round(size * 0.12)) }}
    />
  );
}
