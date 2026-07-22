// components/feature/prediction/OptionsStrategiesTile.tsx — options as a live,
// regime-gated strategy (armed/standby by VIX) so subscribers see it even when
// it holds no position. Public data from /data/options-status.json.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';

interface Strat {
  name: string;
  kind: string;
  gate: string;
  status: 'armed' | 'standby';
  detail: string;
}
interface OptPos {
  ticker: string;
  type: string;
  strike: number;
  expiration: string;
  entry_premium: number;
}
interface StatusData {
  generated_at: string;
  vix: number | null;
  open_count: number;
  open_option_positions: OptPos[];
  strategies: Strat[];
  note: string;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: '#ec4899' }} />
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">Options Strategies</h3>
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

export function OptionsStrategiesTile() {
  const { data, isLoading, isError } = useQuery<StatusData>({
    queryKey: ['options-status'],
    queryFn: async () => {
      const res = await fetch('/data/options-status.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  if (isError) return null;
  if (isLoading || !data) return <Shell><div className="p-4 skeleton h-28" /></Shell>;

  return (
    <Shell>
      <div className="p-4">
        <div className="flex items-baseline gap-3 mb-3 text-sm">
          <span className="text-[var(--color-text-tertiary)]">VIX</span>
          <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>{data.vix ?? '—'}</span>
          <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">{data.open_count} open</span>
        </div>
        <div className="space-y-3">
          {data.strategies.map((s) => (
            <div key={s.name} className="flex items-start gap-3">
              <span
                className="mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                style={{
                  color: s.status === 'armed' ? 'var(--color-bull)' : 'var(--color-text-tertiary)',
                  backgroundColor: s.status === 'armed' ? 'var(--color-bull-soft)' : 'var(--color-bg-elevated)',
                }}
              >
                {s.status}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {s.name} <span className="text-xs font-normal text-[var(--color-text-tertiary)]">· {s.kind}</span>
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{s.detail}</p>
              </div>
            </div>
          ))}
        </div>
        {data.open_option_positions.length > 0 && (
          <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
            {data.open_option_positions.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-xs py-0.5">
                <span className="text-[var(--color-text-primary)]" data-numeric>{p.ticker} ${p.strike} {p.type}</span>
                <span className="text-[var(--color-text-tertiary)]" data-numeric>{p.expiration} · ${p.entry_premium}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-[11px] text-[var(--color-text-tertiary)] leading-relaxed">{data.note}</p>
      </div>
    </Shell>
  );
}
