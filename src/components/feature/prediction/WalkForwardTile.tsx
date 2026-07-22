// components/feature/prediction/WalkForwardTile.tsx — REAL out-of-sample
// walk-forward results from walk_forward_v2.json (Pro-gated, produced weekly
// by run_walk_forward_v2.py). Replaces the hardcoded "coming soon" placeholder
// that shipped on /models while the data file sat unused in production.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { fetchGated, GateError } from '@/lib/api/gated';
import { GateCard } from '@/components/feature/gating/GateCard';
import { InfoTip, PlainLabel } from '@/components/primitives';
import type { GlossaryTerm } from '@/lib/glossary';

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

const LABELS: Record<string, { label: string; term: GlossaryTerm }> = {
  mean_reversion: { label: 'Mean Reversion', term: 'mean_reversion' },
  momentum: { label: 'Momentum', term: 'momentum' },
  breakout: { label: 'Breakout', term: 'breakout' },
  sector_rotation: { label: 'Sector Rotation', term: 'sector_rotation' },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    // Not clipped: the header's <InfoTip> tooltip opens upward, and a clipped
    // box would place it outside the tile where it cannot be seen.
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)]">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">
          <InfoTip term="walk_forward">Walk-Forward Analysis</InfoTip>
        </h3>
        <PlainLabel term="walk_forward" className="mt-0.5" />
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
      return (
        <Shell>
          <div className="p-4">
            <GateCard kind={error.kind} need={error.need ?? 'pro'} feature="Walk-forward analysis" />
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
        {/* min-w keeps the two-line plain-English column captions from
            crushing the five columns on a phone; the wrapper scrolls instead.
            Matches the sibling table in research-client.tsx. */}
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <th className="text-left py-2 pr-3 text-xs text-[var(--color-text-tertiary)] font-medium align-bottom">Strategy</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium align-bottom">
                <InfoTip term="is_sharpe">IS Sharpe</InfoTip>
                <PlainLabel term="is_sharpe" className="mt-0.5 text-right" />
              </th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium align-bottom">
                <InfoTip term="oos_sharpe">OOS Sharpe</InfoTip>
                <PlainLabel term="oos_sharpe" className="mt-0.5 text-right" />
              </th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium align-bottom">
                <InfoTip term="degradation">Degradation</InfoTip>
              </th>
              <th className="text-right py-2 pl-3 text-xs text-[var(--color-text-tertiary)] font-medium align-bottom">
                <InfoTip term="oos_trades">OOS Trades</InfoTip>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([key, s]) => (
              <tr key={key} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <td className="py-2 pr-3 text-[var(--color-text-primary)]">
                  <InfoTip term={LABELS[key].term}>{LABELS[key].label}</InfoTip>
                </td>
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
          Each strategy is tuned on an early stretch of history, then judged only on the later stretch it has never
          seen. The window then rolls forward and it repeats. Degradation is how much worse it does on that unseen
          data — lower is better. Hypothetical results — not indicative of future performance.
        </p>
      </div>
    </Shell>
  );
}
