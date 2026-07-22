// components/feature/market/IndicesCard.tsx — S&P/NDX/TSX/DOW
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { Surface, SurfaceHeader, DeltaBadge, DataFreshness } from '@/components/primitives';
import { formatNumber } from '@/lib/format';

// What each ticker actually tracks. The ticker string stays the visible label —
// this only adds the sentence a first-time investor needs to read it, and the
// four keys match the whitelist below exactly.
const INDEX_DESCRIPTIONS: Record<string, string> = {
  'S&P 500': '500 of the largest US companies',
  // Not "the US market": the figure carried here tracks Nasdaq-listed
  // companies only, so the description has to stop at the exchange.
  NASDAQ: 'Companies listed on the Nasdaq exchange — heavily tech',
  'Dow Jones': '30 large, established US companies',
  TSX: 'Canada’s main index, in Toronto',
};

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
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
          An index tracks a whole basket of shares as one number. The percentage is its move for the day.
        </p>
        {indices.map((idx) => (
          <div key={idx.ticker} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <span className="block text-sm text-[var(--color-text-secondary)]">{idx.ticker}</span>
              {INDEX_DESCRIPTIONS[idx.ticker] && (
                <span className="block text-[10px] leading-snug text-[var(--color-text-tertiary)]">
                  {INDEX_DESCRIPTIONS[idx.ticker]}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
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
