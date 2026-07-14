// components/feature/market/VixRegimeCard.tsx — VIX gauge + regime chip
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, RegimeChip, DataFreshness, InfoTip } from '@/components/primitives';

export function VixRegimeCard() {
  const { data, isLoading } = useQuery(latestQuery());

  if (isLoading || !data) {
    return (
      <Surface span="third">
        <SurfaceHeader title="VIX Regime" />
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
      <SurfaceHeader title={<InfoTip term="vix">VIX / Regime</InfoTip>} right={<DataFreshness timestamp={data.generated_at} />} />
      <div className="p-4 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: vixColor }} data-numeric>
              {vix.toFixed(2)}
            </span>
            <span className="ml-2 text-sm" style={{ color: vixChange < 0 ? 'var(--color-bear)' : 'var(--color-bull)' }}>
              {vixChange > 0 ? '▲' : '▼'} {Math.abs(vixChange).toFixed(2)}%
            </span>
          </div>
          <RegimeChip regime={regime} />
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
          <span>Low (0)</span>
          <span>15</span>
          <span>25</span>
          <span>High (40)</span>
        </div>
      </div>
    </Surface>
  );
}
