// components/feature/market/IndicesCard.tsx — S&P/NDX/TSX/DOW
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, DeltaBadge, DataFreshness } from '@/components/primitives';
import { formatNumber } from '@/lib/format';

export function IndicesCard() {
  const { data, isLoading } = useQuery(latestQuery());

  if (isLoading || !data) {
    return (
      <Surface span="half">
        <SurfaceHeader title="Indices" />
        <div className="p-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-6" />
          ))}
        </div>
      </Surface>
    );
  }

  const indices = data.market_summary.indices.filter((idx) =>
    ['S&P 500', 'NASDAQ', 'Dow Jones', 'TSX'].includes(idx.ticker)
  );

  return (
    <Surface span="half">
      <SurfaceHeader title="Indices" right={<DataFreshness timestamp={data.generated_at} />} />
      <div className="p-4 space-y-3">
        {indices.map((idx) => (
          <div key={idx.ticker} className="flex items-center justify-between">
            <span className="text-sm text-[var(--color-text-secondary)]">{idx.ticker}</span>
            <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              <span className="text-sm font-medium text-[var(--color-text-primary)]" data-numeric>
                {formatNumber(idx.price, idx.price > 1000 ? 0 : 2)}
              </span>
              <DeltaBadge value={idx.change_pct} />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
}
