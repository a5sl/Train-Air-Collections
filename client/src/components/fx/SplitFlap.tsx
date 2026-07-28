import React, { useEffect, useRef, useState } from 'react';
import { motionSpeed, prefersReducedMotion } from '../../lib/motion';

/**
 * 翻牌数字（车站出发牌风格）。
 * 每个数字字符一张翻页；数值变化时逐位翻动，挂载时自 0 逐位翻入。
 */
function FlapChar({ ch, delayMs }: { ch: string; delayMs: number }) {
  const [display, setDisplay] = useState('0');
  const [flipping, setFlipping] = useState(false);
  const prev = useRef('0');
  const timers = useRef<number[]>([]);

  useEffect(() => {
    if (ch === prev.current) return;
    prev.current = ch;
    if (prefersReducedMotion()) { setDisplay(ch); return; }
    const full = 340 / motionSpeed();
    timers.current.forEach(clearTimeout);
    timers.current = [];
    timers.current.push(window.setTimeout(() => {
      setFlipping(true);
      timers.current.push(window.setTimeout(() => setDisplay(ch), full * 0.5));
      timers.current.push(window.setTimeout(() => setFlipping(false), full + 30));
    }, delayMs));
  }, [ch, delayMs]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!/[0-9]/.test(ch)) {
    return <span className="inline-block opacity-70" style={ch === ' ' ? { minWidth: '0.35em' } : undefined}>{ch}</span>;
  }

  return (
    <span className="flap-cell">
      <span className={'flap-char' + (flipping ? ' flipping' : '')}>{display}</span>
    </span>
  );
}

export default function SplitFlap({
  value,
  format,
  className = '',
  stagger = 55,
}: {
  value: number;
  format?: (n: number) => string;
  className?: string;
  stagger?: number;
}) {
  const text = format ? format(value) : value.toLocaleString();
  return (
    <span className={'flap-board ' + className} aria-label={text}>
      {text.split('').map((ch, i) => (
        <FlapChar key={i + ':' + ch} ch={ch} delayMs={i * stagger} />
      ))}
    </span>
  );
}