// components/feature/positions/ActionQueue.tsx — WATCH/SETUP signals
'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader } from '@/components/primitives';
import { formatNumber, formatPercent } from '@/lib/format';

export function ActionQueue() {
  const [tab, setTab] = useState<'setups' | 'watch'>('setups');
  const { data } = useQuery(latestQuery());

  const setups = data?.premarket_top_setups ?? [];

  return (
    <Surface span="third">
      <SurfaceHeader
        title="Action Queue"
        right={
          <div className="flex gap-1 bg-[var(--color-bg-elevated)] rounded-[var(--radius-chip)] p-0.5">
            {(['setups', 'watch'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className="px-3 py-1 text-xs font-medium rounded-md transition-colors min-h-8"
                style={{
                  backgroundColor: tab === t ? 'var(--color-bg-overlay)' : 'transparent',
                  color: tab === t ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                }}
              >
                {t === 'setups' ? 'SETUPS' : 'WATCH'}
              </button>
            ))}
          </div>
        }
      />
      <div className="p-4 space-y-3">
        {tab === 'setups' && setups.map((s) => (
          <div key={s.ticker} className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--color-bg-elevated)] transition-colors">
            <div>
              <span className="text-sm font-medium text-[var(--color-text-primary)]">{s.ticker}</span>
              <span className="ml-2 text-xs text-[var(--color-text-tertiary)]">Score: {s.score}</span>
            </div>
            <div className="flex items-center gap-2" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              <span className="text-sm text-[var(--color-text-primary)]" data-numeric>${formatNumber(s.price)}</span>
              <span className="text-xs" style={{ color: s.change_pct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                {s.change_pct >= 0 ? '▲' : '▼'} {formatPercent(s.change_pct)}
              </span>
            </div>
          </div>
        ))}
        {tab === 'setups' && setups.length === 0 && (
          <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">No setups today</p>
        )}
        {tab === 'watch' && (
          <p className="text-sm text-[var(--color-text-tertiary)] text-center py-4">Watchlist items appear here</p>
        )}
      </div>
    </Surface>
  );
}
