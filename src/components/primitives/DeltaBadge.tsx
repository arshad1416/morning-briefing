// components/primitives/DeltaBadge.tsx — ▲/▼ glyph + signed value + color (never color alone)
'use client';

import React from 'react';

interface DeltaBadgeProps {
  value: number;
  suffix?: string;
  className?: string;
}

export function DeltaBadge({ value, suffix = '%', className = '' }: DeltaBadgeProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isZero = value === 0;

  const color = isZero
    ? 'var(--color-neutral)'
    : isPositive
    ? 'var(--color-bull)'
    : 'var(--color-bear)';

  const bg = isZero
    ? 'transparent'
    : isPositive
    ? 'var(--color-bull-soft)'
    : 'var(--color-bear-soft)';

  const glyph = isZero ? '—' : isPositive ? '▲' : '▼';
  const label = isZero ? 'unchanged' : isPositive ? 'up' : 'down';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[var(--radius-chip)] text-sm font-medium ${className}`}
      style={{
        color,
        backgroundColor: bg,
        fontFamily: 'var(--font-mono)',
        fontVariantNumeric: 'tabular-nums',
      }}
      data-numeric
    >
      <span aria-hidden="true">{glyph}</span>
      <span>{isZero ? '0.00' : `${isPositive ? '+' : ''}${value.toFixed(2)}`}{suffix}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
