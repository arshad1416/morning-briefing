// components/feature/prediction/BacktestSummary.tsx
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { predictionEngineQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader } from '@/components/primitives';
import { GateError } from '@/lib/api/gated';

/**
 * Backtest corpus summary from prediction-engine.json (Pro-gated) — the
 * V-series strategy family backtested across 17k+ trades. This tile
 * previously read accuracy.json (live-sim accuracy — a different thing)
 * against a mock schema that never parsed, so it rendered "unavailable".
 */
export function BacktestSummary() {
  const { data, isLoading, isError, error } = useQuery(predictionEngineQuery());

  if (isError) {
    if (error instanceof GateError && error.kind !== 'unavailable') {
      // Hard-gated 401/403: quiet frame only — the FeatureGate overlay on
      // /models/ is the single pitch (a GateCard here doubled it). Tall enough
      // that the overlay card stays inside the tile.
      return (
        <Surface span="half">
          <SurfaceHeader title="Backtest Summary" />
          <div className="p-4">
            <div className="h-56 rounded-[var(--radius-chip)] bg-[var(--color-bg-elevated)]" />
          </div>
        </Surface>
      );
    }
    return (
      <Surface span="half">
        <SurfaceHeader title="Backtest Summary" />
        <div className="p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
          <p className="text-sm text-[var(--color-text-tertiary)]">
            Backtest data isn&apos;t available right now.
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

  const s = data.summary;
  const cells: Array<{ label: string; value: string; color?: string }> = [
    { label: 'Backtest Trades', value: s.total_backtest_trades.toLocaleString() },
    { label: 'Tickers Tested', value: s.tickers_tested.toLocaleString() },
    { label: 'Date Range', value: s.date_range || '—' },
    { label: 'Best Win Rate', value: s.best_win_rate || '—', color: 'var(--color-bull)' },
    { label: 'Best Avg P&L', value: s.best_avg_pnl || '—', color: 'var(--color-bull)' },
    { label: 'Best Profit Factor', value: s.best_profit_factor || '—' },
  ];

  return (
    <Surface span="half">
      <SurfaceHeader title="Backtest Summary" />
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cells.map((c) => (
            <div key={c.label}>
              <span className="text-xs text-[var(--color-text-tertiary)]">{c.label}</span>
              <p
                className="text-xl font-bold mt-1"
                style={{ fontFamily: 'var(--font-mono)', ...(c.color ? { color: c.color } : {}) }}
                data-numeric
              >
                {c.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
          Historical simulation across the V-series strategy family. Hypothetical results — not
          indicative of future performance.
        </p>
      </div>
    </Surface>
  );
}
