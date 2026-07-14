// components/feature/prediction/AccuracyStats.tsx
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { accuracyQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader } from '@/components/primitives';

export function AccuracyStats() {
  const { data, isLoading, isError } = useQuery(accuracyQuery());

  // accuracy.json is gated premium data — absent in local/preview builds.
  if (isError) {
    return (
      <Surface span="half">
        <SurfaceHeader title="Accuracy Stats" />
        <div className="p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Accuracy data is available on the live deployment.
          </p>
        </div>
      </Surface>
    );
  }

  if (isLoading || !data) {
    return (
      <Surface span="half">
        <SurfaceHeader title="Accuracy Stats" />
        <div className="p-4 skeleton h-24" />
      </Surface>
    );
  }

  const stats = [
    { label: 'Expectancy', value: `$${data.expectancy.toFixed(2)}` },
    { label: 'Win Rate', value: `${(data.hit_rate * 100).toFixed(1)}%` },
    { label: 'Profit Factor', value: data.profit_factor.toFixed(2) },
    { label: 'Max Drawdown', value: `${(data.max_drawdown * 100).toFixed(1)}%` },
    { label: 'Kelly Fraction', value: `${(data.kelly_fraction * 100).toFixed(1)}%` },
    { label: 'Total Trades', value: data.total_signals.toLocaleString() },
  ];

  return (
    <Surface span="half">
      <SurfaceHeader title="Accuracy Stats" />
      <div className="p-4">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center p-3 rounded-lg bg-[var(--color-bg-elevated)]">
              <span className="text-xs text-[var(--color-text-tertiary)] block mb-1">{s.label}</span>
              <span className="text-lg font-bold" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} data-numeric>
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Surface>
  );
}
