// components/feature/options/GexDexVexCard.tsx — regime + GEX/DEX/VEX summary
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gexQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, RegimeChip, InfoTip, DataFreshness } from '@/components/primitives';
import { formatCompact } from '@/lib/format';

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
      <div className="p-4 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              <InfoTip term="gex">GEX</InfoTip>
            </span>
            <p className="text-lg font-semibold mt-1" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} data-numeric>
              {formatCompact(mode.total_gex)}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              <InfoTip term="dex">DEX</InfoTip>
            </span>
            <p className="text-lg font-semibold mt-1" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} data-numeric>
              {formatCompact(mode.total_dex)}
            </p>
          </div>
          <div>
            <span className="text-xs text-[var(--color-text-tertiary)]">
              <InfoTip term="vex">VEX</InfoTip>
            </span>
            <p className="text-lg font-semibold mt-1" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }} data-numeric>
              {formatCompact(mode.total_vex)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-[var(--color-text-tertiary)]">
          <span>
            <InfoTip term="max_pain">Max GEX Strike</InfoTip>:{' '}
            <span className="text-[var(--color-text-primary)]" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
              ${mode.max_gex_strike.toFixed(0)}
            </span>
          </span>
          <span>SPY @ ${mode.price.toFixed(2)}</span>
        </div>
      </div>
    </Surface>
  );
}
