// components/feature/prediction/OptionsStrategiesTile.tsx — options as a live,
// regime-gated strategy (armed/standby by VIX) so subscribers see it even when
// it holds no position. Public data from /data/options-status.json.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { InfoTip } from '@/components/primitives';

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
    // Not clipped: the <InfoTip> tooltips inside open upward, and near the top
    // of the tile a clipped box would cut them off entirely.
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)]">
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
          <span className="text-[var(--color-text-tertiary)]"><InfoTip term="vix">VIX</InfoTip></span>
          <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>{data.vix ?? '—'}</span>
          {/* open_count counts entries in open_option_positions, and one entry
              can be several contracts (a credit spread is at least two), so this
              must not be phrased as a contract count. */}
          <span className="ml-auto text-xs text-[var(--color-text-tertiary)]">
            {data.open_count} {data.open_count === 1 ? 'position' : 'positions'} open
          </span>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
          Options are contracts whose payoff depends on where a share price sits by a set date — a more advanced tool
          than the shares and funds elsewhere on this site. Each strategy below only trades when conditions suit it, and
          the VIX reading above is the main gate: <span className="font-semibold">armed</span> means the VIX gate is
          clear, so the strategy will act as soon as a qualifying signal appears;{' '}
          <span className="font-semibold">standby</span> means the gate is shut and it is sitting out.
        </p>
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
            <p className="mb-1 text-[10px] text-[var(--color-text-tertiary)]">
              Open positions — stock, <InfoTip term="strike">strike price</InfoTip> and type, then the expiry date and
              the price paid per contract when it was opened.
            </p>
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
