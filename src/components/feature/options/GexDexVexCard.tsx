// components/feature/options/GexDexVexCard.tsx — regime + GEX/DEX/VEX summary
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gexQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, RegimeChip, InfoTip, PlainLabel, DataFreshness } from '@/components/primitives';
import { formatCompact } from '@/lib/format';
import type { GlossaryTerm } from '@/lib/glossary';

function SignBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(1, Math.abs(value) / max) * 50 : 0;
  const positive = value >= 0;

  return (
    <div className="relative h-1 rounded-full mt-2 overflow-hidden" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
      {/* zero axis */}
      <span className="absolute left-1/2 top-0 bottom-0 w-px" style={{ backgroundColor: 'var(--color-border-strong)' }} aria-hidden="true" />
      <span
        className="absolute top-0 bottom-0 rounded-full"
        style={{
          backgroundColor: positive ? 'var(--color-bull)' : 'var(--color-bear)',
          left: positive ? '50%' : `${50 - pct}%`,
          width: `${pct}%`,
        }}
        aria-hidden="true"
      />
    </div>
  );
}

export function GexDexVexCard() {
  const { data, isLoading } = useQuery(gexQuery());

  if (isLoading || !data) {
    return (
      <Surface span="third">
        <SurfaceHeader title="GEX/DEX/VEX" />
        <div className="p-4 skeleton h-24" />
      </Surface>
    );
  }

  const mode = data.modes.all;
  const metrics: Array<{ key: GlossaryTerm; label: string; value: number }> = [
    { key: 'gex', label: 'GEX', value: mode.total_gex },
    { key: 'dex', label: 'DEX', value: mode.total_dex },
    { key: 'vex', label: 'VEX', value: mode.total_vex },
  ];
  const dominant = metrics.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a));

  return (
    <Surface span="third">
      <SurfaceHeader
        title={<InfoTip term="gex">GEX / DEX / VEX</InfoTip>}
        right={
          <div className="flex items-center gap-2">
            <DataFreshness timestamp={data.generated_at} />
            <RegimeChip regime={mode.gamma_regime} />
          </div>
        }
      />
      <div className="p-4 space-y-4 relative">
        <div className="grid grid-cols-3 gap-4">
          {metrics.map((m) => (
            <div key={m.key} className="relative">
              {m.key === dominant.key && (
                <span
                  aria-hidden="true"
                  className="glow-orb -top-14 -left-8"
                  style={{
                    width: 150,
                    height: 150,
                    ['--glow-color' as string]:
                      m.value >= 0 ? 'rgba(16,185,129,0.14)' : 'rgba(255,69,87,0.14)',
                  }}
                />
              )}
              <span className="relative z-10 block text-[10px] uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                <InfoTip term={m.key}>{m.label}</InfoTip>
                <PlainLabel term={m.key} className="mt-0.5" />
              </span>
              <p
                className="relative z-10 text-lg font-semibold mt-1"
                style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
                data-numeric
              >
                {formatCompact(m.value)}
              </p>
              <div className="relative z-10">
                {/* BUG FIX: was <SignBar value={m.value} max={maxAbs} /> with maxAbs
                    shared across all three metrics. GEX ($), DEX (shares) and VEX
                    (vega units) are different units at wildly different magnitudes
                    (e.g. GEX ~2.7M vs VEX ~991M), so plotting GEX against a max set
                    by VEX drew it as a sliver indistinguishable from zero. Each bar
                    is now scaled to its own value, so it always shows a full-length
                    bar in the correct direction — an honest sign indicator, since
                    there is no valid shared scale across incompatible units. */}
                <SignBar value={m.value} max={Math.abs(m.value)} />
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)] relative z-10">
          <span>
            {/* Was term="max_pain" — but this value is `max_gex_strike`, the
                largest-gamma strike, which is a different number from max pain
                (both are in this dataset and they differ). The tooltip was
                explaining the wrong metric. */}
            <InfoTip term="max_gex_strike">Max GEX Strike</InfoTip>:{' '}
            <span className="text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
              ${mode.max_gex_strike.toFixed(0)}
            </span>
          </span>
          <span data-numeric>
            {data.ticker} @ ${mode.price.toFixed(2)}
          </span>
        </div>
      </div>
    </Surface>
  );
}
