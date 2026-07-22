// components/feature/prediction/CryptoCohortsTile.tsx — the crypto asset class.
//
// 7 isolated $10K books mirroring live trader.dev signals on Bybit USDT perps,
// shown alongside the equity/ETF paper simulation so the multi-asset coverage
// is visible. Public data (aggregate metadata only), fetched from
// /data/crypto-cohorts.json (publish_crypto_cohorts.py on the Pi).
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface Cohort {
  id: string;
  name: string;
  instrument: string;
  equity: number;
  return_pct: number;
  wins: number;
  losses: number;
  trades: number;
  win_rate: number | null;
  open: boolean;
}
interface CohortsData {
  generated_at: string;
  cohort_count: number;
  total_equity: number;
  total_return_pct: number;
  total_trades: number;
  note: string;
  cohorts: Cohort[];
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#f7931a' }} />
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">
          Crypto Strategy Cohorts
        </h3>
        {/* Advertised under Pro on the landing page; data is public for now. */}
        <span
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ backgroundColor: 'var(--color-accent-dim)', color: 'var(--color-accent)' }}
          title="Free preview — subscriber-only controls arrive with Pro"
        >
          Pro preview
        </span>
      </div>
      {children}
    </div>
  );
}

export function CryptoCohortsTile() {
  const { data, isLoading, isError } = useQuery<CohortsData>({
    queryKey: ['crypto-cohorts'],
    queryFn: async () => {
      const res = await fetch('/data/crypto-cohorts.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isError) return null; // silently omit if not published
  if (isLoading || !data) {
    return <Shell><div className="p-4 skeleton h-32" /></Shell>;
  }

  return (
    <Shell>
      <div className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">Strategies</span>
            <p className="text-xl font-bold mt-0.5" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>{data.cohort_count}</p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">Combined Equity</span>
            <p className="text-xl font-bold mt-0.5" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>${data.total_equity.toLocaleString()}</p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">Total Return</span>
            <p className="text-xl font-bold mt-0.5" style={{ fontFamily: 'var(--font-mono)', color: data.total_return_pct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }} data-numeric>
              {data.total_return_pct >= 0 ? '+' : ''}{data.total_return_pct.toFixed(2)}%
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">Fills</span>
            <p className="text-xl font-bold mt-0.5" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>{data.total_trades}</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                <th className="text-left py-2 pr-3 text-xs text-[var(--color-text-tertiary)] font-medium">Strategy</th>
                <th className="text-left py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Instrument</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Equity</th>
                <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Return</th>
                <th className="text-right py-2 pl-3 text-xs text-[var(--color-text-tertiary)] font-medium">W / L</th>
              </tr>
            </thead>
            <tbody>
              {data.cohorts.map((c) => (
                <tr key={c.id} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-2 pr-3 text-[var(--color-text-primary)]">
                    {c.name}
                    {c.open && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ backgroundColor: 'var(--color-bull)' }} title="position open" />}
                  </td>
                  <td className="py-2 px-3 text-[var(--color-text-secondary)]" data-numeric>{c.instrument}</td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]" data-numeric>${c.equity.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right" style={{ color: c.return_pct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }} data-numeric>
                    {c.return_pct >= 0 ? '+' : ''}{c.return_pct.toFixed(2)}%
                  </td>
                  <td className="py-2 pl-3 text-right text-[var(--color-text-secondary)]" data-numeric>{c.wins} / {c.losses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">{data.note}</p>
      </div>
    </Shell>
  );
}
