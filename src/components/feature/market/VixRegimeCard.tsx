// components/feature/market/VixRegimeCard.tsx — VIX gauge + regime chip
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, RegimeChip, DataFreshness, InfoTip, PlainLabel } from '@/components/primitives';

// One title node for both states. The skeleton used to render a bare "VIX
// Regime" string, so the acronym went unexplained until data landed — and
// "Regime" was never explained at all, even though the glossary defines it.
//
// The always-on <PlainLabel> lives in the card body, not here: SurfaceHeader is
// a one-line `flex items-center justify-between` row, and a block caption
// inside the <h3> wraps the title against the DataFreshness badge.
const TITLE = (
  <>
    <InfoTip term="vix">VIX</InfoTip> / <InfoTip term="regime">Regime</InfoTip>
  </>
);

export function VixRegimeCard() {
  const { data, isLoading } = useQuery(latestQuery());

  if (isLoading || !data) {
    return (
      <Surface span="third">
        <SurfaceHeader title={TITLE} />
        <div className="p-4 skeleton h-20" />
      </Surface>
    );
  }

  const vix = data.market_summary.vix;
  const vixChange = data.market_summary.indices.find((i) => i.ticker === 'VIX')?.change_pct ?? 0;

  // Regime logic
  let regime: 'bullish' | 'bearish' | 'neutral' = 'neutral';
  if (vix < 15) regime = 'bullish';
  else if (vix > 25) regime = 'bearish';
  else if (vix < 20) regime = 'neutral';

  const vixColor = vix < 15 ? 'var(--color-bull)' : vix > 25 ? 'var(--color-bear)' : vix > 20 ? 'var(--color-caution)' : 'var(--color-neutral)';

  return (
    <Surface span="third">
      <SurfaceHeader title={TITLE} right={<DataFreshness timestamp={data.generated_at} />} />
      <div className="p-4 flex flex-col gap-4">
        <PlainLabel term={['vix', 'regime']} />
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: vixColor }} data-numeric>
              {vix.toFixed(2)}
            </span>
            {/* BUG FIX (DATA-BUGS-2026-07-22, MEDIUM, VixRegimeCard.tsx:51): this
                colour test was inverted — a rising VIX (more fear, bad for
                stocks) was painted bull-green and a falling VIX (less fear,
                good for stocks) was painted bear-red, backwards under either
                convention and contradicting the regime logic just above,
                which treats a high VIX as bearish. Swapped so a rise is red
                and a fall is green, matching the regime chip beside it. */}
            <span className="ml-2 text-sm" style={{ color: vixChange < 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
              {vixChange > 0 ? '▲' : '▼'} {Math.abs(vixChange).toFixed(2)}%
            </span>
            {/* Names both numbers on the line. The earlier "Change in the VIX
                today" sat under the level as well as the percent, so the
                dominant figure above it — the level — read as a change. */}
            <span className="block mt-1 text-[10px] text-[var(--color-text-tertiary)]">
              VIX level, and its change today
            </span>
          </div>
          <div className="text-right shrink-0">
            <RegimeChip regime={regime} />
            <span className="block mt-1 text-[10px] text-[var(--color-text-tertiary)]">
              Mood read from the VIX alone
            </span>
          </div>
        </div>

        {/* VIX scale: calm emerald → stressed red, with a position marker */}
        <div className="relative h-2 rounded-full" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
          <div
            className="absolute inset-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, #10B981 0%, #EAB308 50%, #FF4557 100%)',
              opacity: 0.25,
            }}
            aria-hidden="true"
          />
          {/* Markers at 15 / 25 */}
          <div className="absolute top-0 h-full border-l border-[var(--color-text-tertiary)] opacity-30" style={{ left: '37.5%' }} />
          <div className="absolute top-0 h-full border-l border-[var(--color-text-tertiary)] opacity-30" style={{ left: '62.5%' }} />
          {/* Position dot */}
          <span
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 transition-all"
            style={{
              left: `${Math.min(100, (vix / 40) * 100)}%`,
              backgroundColor: 'var(--color-accent)',
              borderColor: 'var(--color-bg-surface)',
              boxShadow: '0 0 8px color-mix(in srgb, var(--color-accent) 60%, transparent)',
            }}
            aria-hidden="true"
          />
        </div>
        <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
          <span>Calm (0)</span>
          <span>15</span>
          <span>25</span>
          <span>Stressed (40)</span>
        </div>
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
          The scale is in VIX points, not percent. Under 15 counts as calm here and over 25 as stressed.
          The label above is read straight off that one number, so it describes how nervous the market is
          — not which way prices are heading.
        </p>
      </div>
    </Surface>
  );
}
