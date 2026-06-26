// components/primitives/RegimeChip.tsx — BULLISH / BEARISH / NEUTRAL (glyph + color + text)
'use client';

import React from 'react';

interface RegimeChipProps {
  regime: 'bullish' | 'bearish' | 'neutral';
  className?: string;
}

const regimeConfig = {
  bullish: { glyph: '▲', label: 'BULLISH', color: 'var(--color-bull)', bg: 'var(--color-bull-soft)' },
  bearish: { glyph: '▼', label: 'BEARISH', color: 'var(--color-bear)', bg: 'var(--color-bear-soft)' },
  neutral: { glyph: '●', label: 'NEUTRAL', color: 'var(--color-neutral)', bg: 'var(--color-bg-elevated)' },
} as const;

export function RegimeChip({ regime, className = '' }: RegimeChipProps) {
  const config = regimeConfig[regime];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-chip)] text-xs font-semibold uppercase tracking-wider ${className}`}
      style={{ color: config.color, backgroundColor: config.bg }}
    >
      <span aria-hidden="true">{config.glyph}</span>
      <span>{config.label}</span>
      <span className="sr-only">{regime}</span>
    </span>
  );
}
