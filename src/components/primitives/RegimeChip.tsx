// components/primitives/RegimeChip.tsx — BULLISH / BEARISH / NEUTRAL (glyph + color + text)
//
// Deliberately context-free: the chip renders whatever reading it is handed and
// never asserts what that reading is ABOUT. That matters, because none of its
// current call sites is a price forecast — on the options pages it reflects the
// gamma regime (is dealer hedging steadying the market or amplifying it), and on
// the VIX card it reflects how calm or stressed volatility is. A beginner reads
// "BEARISH" as "prices will fall", so the surrounding card must supply the
// meaning — wrap its heading in <InfoTip term="gamma_regime"> or
// <InfoTip term="regime"> rather than leaving the chip to speak for itself.
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
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-chip)] text-xs font-semibold uppercase tracking-wider border ${className}`}
      style={{
        color: config.color,
        backgroundColor: config.bg,
        borderColor: `color-mix(in srgb, ${config.color} 25%, transparent)`,
      }}
    >
      <span aria-hidden="true">{config.glyph}</span>
      {/* The visible label is already read out; the old sr-only copy of `regime`
          just made screen readers say "BULLISH bullish". */}
      <span>{config.label}</span>
    </span>
  );
}
