// components/primitives/ConvictionGauge.tsx — 0–10 arc gauge
'use client';

import React from 'react';

interface ConvictionGaugeProps {
  value: number; // 0–10
  size?: number;
  className?: string;
}

export function ConvictionGauge({ value, size = 140, className = '' }: ConvictionGaugeProps) {
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

  // Color: bearish (red) → neutral (yellow) → bullish (green)
  const hue = normalized < 0.5 ? 0 + normalized * 2 * 40 : 40 + (normalized - 0.5) * 2 * 110;
  const color = `hsl(${hue}, 75%, 55%)`;

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Conviction: ${clamped.toFixed(1)} out of 10`}>
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
