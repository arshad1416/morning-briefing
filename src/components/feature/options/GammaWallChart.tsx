// components/feature/options/GammaWallChart.tsx — horizontal bars of OI by strike
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gexQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, InfoTip } from '@/components/primitives';
import { formatCompact } from '@/lib/format';

export function GammaWallChart() {
  const { data, isLoading } = useQuery(gexQuery());

  if (isLoading || !data) {
    return (
      <Surface span="hero">
        <SurfaceHeader title="Gamma Wall" />
        <div className="p-4 skeleton h-64" />
      </Surface>
    );
  }

  const mode = data.modes.all;
  const strikes = mode.strikes.slice(0, 20); // Top 20
  const maxGex = Math.max(...strikes.map((s) => s.gex));
  const currentPrice = mode.price;

  return (
    <Surface span="hero">
      <SurfaceHeader
        title={<InfoTip term="gamma_wall">Gamma Wall — {data.ticker}</InfoTip>}
        right={
          <span className="text-xs text-[var(--color-text-tertiary)]" style={{ fontFamily: 'var(--font-mono)' }}>
            {mode.expiry_count} expiries
          </span>
        }
      />
      <div className="p-4">
        {/* Current price marker */}
        <div className="text-xs text-[var(--color-text-tertiary)] mb-3" style={{ fontFamily: 'var(--font-mono)' }}>
          Current: <span className="text-[var(--color-accent)]">${currentPrice.toFixed(2)}</span>
        </div>

        <div className="space-y-1.5">
          {strikes.map((s) => {
            const pct = (s.gex / maxGex) * 100;
            const isCall = s.type === 'C';
            const isNearPrice = Math.abs(s.strike - currentPrice) / currentPrice < 0.02;

            return (
              <div key={`${s.strike}-${s.type}`} className="flex items-center gap-3 group">
                <span
                  className="w-16 text-xs text-right shrink-0"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    color: isNearPrice ? 'var(--color-accent)' : 'var(--color-text-tertiary)',
                  }}
                  data-numeric
                >
                  ${s.strike.toFixed(0)}
                </span>
                <span className="w-4 text-xs text-center" style={{ color: isCall ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                  {isCall ? 'C' : 'P'}
                </span>
                <div className="flex-1 h-5 bg-[var(--color-bg-elevated)] rounded overflow-hidden relative">
                  <div
                    className="h-full rounded transition-all group-hover:brightness-110"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: isCall ? 'var(--color-bull)' : 'var(--color-bear)',
                      opacity: 0.7,
                    }}
                  />
                </div>
                <span className="w-16 text-xs text-[var(--color-text-tertiary)] opacity-0 group-hover:opacity-100 transition-opacity" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
                  {formatCompact(s.gex)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </Surface>
  );
}
