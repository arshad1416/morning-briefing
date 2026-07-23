// components/primitives/ConvictionGauge.tsx — 0–10 arc gauge
//
// The gauge deliberately draws no noun of its own: it is handed a bare 0–10
// number and the caller decides what that number is. The visible "Conviction"
// label and its plain-English caption therefore live in VerdictBar, next to the
// signal chip they belong with — duplicating them inside the 140px arc would
// print the same word twice on the dashboard's largest element.
//
// The accessible name below still has to stand alone, because a screen-reader
// user meets the arc before the caller's caption. "Conviction" reads as "how
// sure the model is", which is the one thing this number is NOT — it is a
// direction score — so the default aria-label says what it measures instead.
// That default is written for the one caller that exists today (VerdictBar,
// which scores the whole market). Any other caller — a per-ticker score, a
// backtest score — must pass `ariaLabel`, because "today's market" and
// "bullish/bearish" would be assertions this gauge cannot vouch for.
'use client';

import React from 'react';

interface ConvictionGaugeProps {
  value: number; // 0–10
  size?: number;
  className?: string;
  /** Accessible name for the arc. Override whenever the number is not the market-wide conviction score. */
  ariaLabel?: string;
}

export function ConvictionGauge({ value, size = 140, className = '', ariaLabel }: ConvictionGaugeProps) {
  const clamped = Math.max(0, Math.min(10, value));
  const normalized = clamped / 10;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const cx = size / 2;
  const cy = size / 2 + 10;

  // Arc from -135deg to +135deg (270deg sweep)
  const startAngle = -225;
  const endAngle = 45;
  const sweep = endAngle - startAngle;
  const currentAngle = startAngle + sweep * normalized;

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(start: number, end: number) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  // Color: token stops — bearish below 4, cautious 4–6, bullish above 6
  const color =
    normalized < 0.4 ? 'var(--color-bear)' : normalized <= 0.6 ? 'var(--color-caution)' : 'var(--color-bull)';

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          ariaLabel ??
          `Today’s market score: ${clamped.toFixed(1)} out of 10. Higher leans bullish, lower leans bearish.`
        }
      >
        {/* Background arc */}
        <path
          d={describeArc(startAngle, endAngle)}
          fill="none"
          stroke="var(--color-bg-elevated)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d={describeArc(startAngle, currentAngle)}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px color-mix(in srgb, ${color} 55%, transparent))` }}
        />
      </svg>
      {/* Center value */}
      <div className="absolute inset-0 flex flex-col items-center justify-center pt-2">
        <span
          className="text-[2.75rem] font-bold leading-none"
          style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color }}
          data-numeric
        >
          {clamped.toFixed(1)}
        </span>
        <span className="text-xs text-[var(--color-text-tertiary)] mt-1">/10</span>
      </div>
    </div>
  );
}
