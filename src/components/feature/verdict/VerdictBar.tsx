// components/feature/verdict/VerdictBar.tsx — hero A1 component
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { verdictQuery } from '@/lib/query/options';
import { ConvictionGauge, DataFreshness, Surface } from '@/components/primitives';

export function VerdictBar() {
  const { data: verdict, isLoading } = useQuery(verdictQuery());

  if (isLoading || !verdict) {
    return (
      <Surface span="hero" className="p-6">
        <div className="skeleton h-8 w-3/4 mb-4" />
        <div className="skeleton h-4 w-full" />
      </Surface>
    );
  }

  const signalLabel = verdict.signal === 'bullish' ? 'BULLISH' : verdict.signal === 'bearish' ? 'BEARISH' : 'NEUTRAL';
  const signalColor = verdict.signal === 'bullish' ? 'var(--color-bull)' : verdict.signal === 'bearish' ? 'var(--color-bear)' : 'var(--color-neutral)';

  return (
    <Surface span="hero" glow className="p-6">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-6">
        <ConvictionGauge value={verdict.conviction * 10} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-3">
            <span
              className="text-lg font-bold uppercase tracking-wider"
              style={{ color: signalColor, fontFamily: 'var(--font-mono)' }}
            >
              {verdict.signal === 'bullish' ? '▲' : verdict.signal === 'bearish' ? '▼' : '●'} {signalLabel}
            </span>
            <DataFreshness timestamp={verdict.generated_at} />
          </div>

          <p className="text-base text-[var(--color-text-secondary)] leading-relaxed">
            {verdict.narrative}
          </p>

          <div className="mt-3 flex items-center gap-4 text-xs text-[var(--color-text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>
            <span>CI: [{verdict.confidence_interval[0].toFixed(2)}, {verdict.confidence_interval[1].toFixed(2)}]</span>
            <span>VIX: {verdict.model_features.vix}</span>
            <span>Breadth: {verdict.model_features.breadth.toFixed(2)}</span>
            <span>Hit Rate: {(verdict.model_features.recent_hit_rate * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </Surface>
  );
}
