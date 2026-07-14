// components/feature/prediction/BacktestSummary.tsx
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { accuracyQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader } from '@/components/primitives';

export function BacktestSummary() {
  const { data, isLoading, isError } = useQuery(accuracyQuery());

  // accuracy.json is gated premium data — absent in local/preview builds.
  if (isError) {
    return (
      <Surface span="half">
        <SurfaceHeader title="Backtest Summary" />
        <div className="p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Backtest data is available on the live deployment.
          </p>
        </div>
      </Surface>
    );
  }

  if (isLoading || !data) {
    return (
      <Surface span="half">
        <SurfaceHeader title="Backtest Summary" />
        <div className="p-4 skeleton h-24" />
      </Surface>
    );
  }

  return (
    <Surface span="half">
      <SurfaceHeader title="Backtest Summary" />
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">Total Signals</span>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
              {data.total_signals.toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">Win Rate</span>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-bull)' }} data-numeric>
              {(data.hit_rate * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">W / L</span>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
              {data.win_count} / {data.loss_count}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">Profit Factor</span>
            <p className="text-2xl font-bold mt-1" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
              {data.profit_factor.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </Surface>
  );
}
