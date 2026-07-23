// components/feature/prediction/BacktestSummary.tsx
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { predictionEngineQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, InfoTip } from '@/components/primitives';
import type { GlossaryTerm } from '@/lib/glossary';
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
  const cells: Array<{ label: string; value: string; color?: string; term?: GlossaryTerm }> = [
    { label: 'Backtest Trades', value: s.total_backtest_trades.toLocaleString() },
    { label: 'Tickers Tested', value: s.tickers_tested.toLocaleString() },
    { label: 'Date Range', value: s.date_range || '—' },
    { label: 'Best Win Rate', value: s.best_win_rate || '—', color: 'var(--color-bull)', term: 'win_rate' },
    // best_avg_pnl is a percent-per-trade string — "P&L" read as dollars.
    { label: 'Best Avg Return', value: s.best_avg_pnl || '—', color: 'var(--color-bull)', term: 'avg_pnl' },
    { label: 'Best Profit Factor', value: s.best_profit_factor || '—', term: 'profit_factor' },
  ];

  return (
    <Surface span="half">
      <SurfaceHeader title="Backtest Summary" />
      <div className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {cells.map((c) => (
            <div key={c.label}>
              <span className="text-xs text-[var(--color-text-tertiary)]">
                {c.term ? <InfoTip term={c.term}>{c.label}</InfoTip> : c.label}
              </span>
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
        {/* The `backtest` explanation lives here rather than on the tile title:
            Surface clips its contents, so a tooltip on the topmost header row
            would be cut off, while one raised from this footnote is visible. */}
        <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
          Every version of our model (V1 onward) replayed against past prices — a{' '}
          <InfoTip term="backtest">backtest</InfoTip>. Each &ldquo;best&rdquo; figure is the highest any single version
          reached on that metric, so they need not all come from the same version. Returns here are percentages per
          trade, not dollars. Hypothetical results — not indicative of future performance.
        </p>
      </div>
    </Surface>
  );
}
