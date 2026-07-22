// components/feature/prediction/WalkForwardTile.tsx — REAL out-of-sample
// walk-forward results from walk_forward_v2.json (Pro-gated, produced weekly
// by run_walk_forward_v2.py). Replaces the hardcoded "coming soon" placeholder
// that shipped on /models while the data file sat unused in production.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchGated, GateError } from '@/lib/api/gated';

const StrategyWfSchema = z
  .object({
    avg_is_sharpe: z.number().nullable().default(null),
    avg_oos_sharpe: z.number().nullable().default(null),
    avg_degradation_pct: z.number().nullable().default(null),
    total_oos_trades: z.number().nullable().default(null),
  })
  .passthrough();

const WalkForwardSchema = z
  .object({
    summary: z.record(StrategyWfSchema).default({}),
  })
  .passthrough();

const LABELS: Record<string, string> = {
  mean_reversion: 'Mean Reversion',
  momentum: 'Momentum',
  breakout: 'Breakout',
  sector_rotation: 'Sector Rotation',
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">
          Walk-Forward Analysis
        </h3>
      </div>
      {children}
    </div>
  );
}

export function WalkForwardTile() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['walk-forward-v2'],
    queryFn: () => fetchGated('walk_forward_v2.json', WalkForwardSchema),
    staleTime: 60 * 60 * 1000,
  });

  if (isError) {
    if (error instanceof GateError && error.kind !== 'unavailable') {
      // Quiet frame only — the FeatureGate overlay on /models/ is the single
      // pitch (see BacktestSummary).
      return (
        <Shell>
          <div className="p-4">
            <div className="h-56 rounded-[var(--radius-chip)] bg-[var(--color-bg-elevated)]" />
          </div>
        </Shell>
      );
    }
    return (
      <Shell>
        <div className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">
          Walk-forward data isn&apos;t available right now.
        </div>
      </Shell>
    );
  }

  if (isLoading || !data) {
    return (
      <Shell>
        <div className="p-4 skeleton h-32" />
      </Shell>
    );
  }

  const rows = Object.entries(data.summary).filter(([k]) => LABELS[k]);

  return (
    <Shell>
      <div className="p-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <th className="text-left py-2 pr-3 text-xs text-[var(--color-text-tertiary)] font-medium">Strategy</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">IS Sharpe</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">OOS Sharpe</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Degradation</th>
              <th className="text-right py-2 pl-3 text-xs text-[var(--color-text-tertiary)] font-medium">OOS Trades</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, s]) => (
              <tr key={key} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <td className="py-2 pr-3 text-[var(--color-text-primary)]">{LABELS[key]}</td>
                <td className="py-2 px-3 text-right" data-numeric>{s.avg_is_sharpe != null ? s.avg_is_sharpe.toFixed(2) : '—'}</td>
                <td className="py-2 px-3 text-right" data-numeric>{s.avg_oos_sharpe != null ? s.avg_oos_sharpe.toFixed(2) : '—'}</td>
                <td
                  className="py-2 px-3 text-right"
                  style={{ color: (s.avg_degradation_pct ?? 0) > 50 ? 'var(--color-bear)' : 'var(--color-text-primary)' }}
                  data-numeric
                >
                  {s.avg_degradation_pct != null ? `${s.avg_degradation_pct.toFixed(0)}%` : '—'}
                </td>
                <td className="py-2 pl-3 text-right" data-numeric>{s.total_oos_trades ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)]">
          Out-of-sample validation across rolling windows. Degradation = how much the in-sample edge
          decays out of sample; lower is better. Hypothetical results — not indicative of future performance.
        </p>
      </div>
    </Shell>
  );
}
