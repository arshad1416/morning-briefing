// components/feature/prediction/SimulationTile.tsx — the live $100k paper
// simulation summary from simulation.json (Pro-gated, regenerated 9:35/16:35
// ET). The legacy Models page had this view; it was lost in the Next port
// while the paywalled file kept being generated daily for no one.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchGated, GateError } from '@/lib/api/gated';
import { GateCard } from '@/components/feature/gating/GateCard';
import { SimulationSchema } from '@/lib/schemas/market';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">
          Live Simulation — $100K Paper Account
        </h3>
      </div>
      {children}
    </div>
  );
}

const pct = (v: number | null) => (v != null ? `${(v * 100).toFixed(1)}%` : '—');

export function SimulationTile() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['simulation'],
    queryFn: () => fetchGated('simulation.json', SimulationSchema),
    staleTime: 30 * 60 * 1000,
  });

  if (isError) {
    if (error instanceof GateError && error.kind !== 'unavailable') {
      return (
        <Shell>
          <div className="p-4">
            <GateCard kind={error.kind} need={error.need ?? 'pro'} feature="Live simulation" />
          </div>
        </Shell>
      );
    }
    return (
      <Shell>
        <div className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">
          Simulation data isn&apos;t available right now.
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

  const s = data.summary;
  const metrics: Array<{ label: string; value: string; tone?: 'bull' | 'bear' }> = [
    {
      label: 'Total Return',
      value: pct(s.total_return),
      tone: (s.total_return ?? 0) >= 0 ? 'bull' : 'bear',
    },
    { label: 'Sharpe', value: s.sharpe != null ? s.sharpe.toFixed(2) : '—' },
    { label: 'Max Drawdown', value: pct(s.max_drawdown), tone: 'bear' },
    { label: 'Win Rate', value: pct(s.win_rate) },
    { label: 'Closed Trades', value: s.total_trades != null ? String(s.total_trades) : '—' },
    { label: 'Avg Trade', value: s.avg_trade != null ? `$${s.avg_trade.toFixed(2)}` : '—' },
  ];

  return (
    <Shell>
      <div className="p-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
          Simulated portfolio — not a recommendation
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          {metrics.map((m) => (
            <div key={m.label}>
              <span className="text-xs text-[var(--color-text-tertiary)]">{m.label}</span>
              <p
                className="text-xl font-bold mt-1"
                style={{
                  fontFamily: 'var(--font-mono)',
                  ...(m.tone ? { color: m.tone === 'bull' ? 'var(--color-bull)' : 'var(--color-bear)' } : {}),
                }}
                data-numeric
              >
                {m.value}
              </p>
            </div>
          ))}
        </div>
        {data.strategies.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <th className="text-left py-2 pr-3 text-xs text-[var(--color-text-tertiary)] font-medium">Strategy</th>
                  <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Return</th>
                  <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Trades</th>
                  <th className="text-right py-2 pl-3 text-xs text-[var(--color-text-tertiary)] font-medium">Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {data.strategies.map((st) => (
                  <tr key={st.name} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="py-2 pr-3 text-[var(--color-text-primary)]">{st.name}</td>
                    <td
                      className="py-2 px-3 text-right"
                      style={{ color: (st.return ?? 0) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}
                      data-numeric
                    >
                      {pct(st.return)}
                    </td>
                    <td className="py-2 px-3 text-right" data-numeric>{st.trades ?? '—'}</td>
                    <td className="py-2 pl-3 text-right" data-numeric>{pct(st.win_rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
