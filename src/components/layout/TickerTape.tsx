// components/layout/TickerTape.tsx — live index marquee fed by latestQuery
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { POLL } from '@/lib/query/policy';
import { formatNumber, formatPercent } from '@/lib/format';

interface TickerItem {
  label: string;
  value: string;
  changePct?: number;
}

function TickerEntry({ item }: { item: TickerItem }) {
  const hasDelta = item.changePct !== undefined;
  const up = hasDelta && item.changePct! > 0;
  const down = hasDelta && item.changePct! < 0;

  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap">
      <span className="text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {item.label}
      </span>
      <span className="text-xs font-medium text-[var(--color-text-primary)]" data-numeric>
        {item.value}
      </span>
      {hasDelta && (
        <span
          className="text-[11px]"
          style={{ color: up ? 'var(--color-bull)' : down ? 'var(--color-bear)' : 'var(--color-neutral)' }}
          data-numeric
        >
          <span aria-hidden="true">{up ? '▲' : down ? '▼' : '—'}</span> {formatPercent(item.changePct!)}
        </span>
      )}
    </span>
  );
}

function TickerRun({ items, dupe }: { items: TickerItem[]; dupe?: boolean }) {
  return (
    <span
      className="flex items-center gap-3 pr-3"
      aria-hidden={dupe ? 'true' : undefined}
      data-dupe={dupe ? '' : undefined}
    >
      {items.map((item) => (
        <React.Fragment key={item.label}>
          <TickerEntry item={item} />
          <span
            aria-hidden="true"
            className="w-[3px] h-[3px] rounded-full shrink-0"
            style={{ backgroundColor: 'var(--color-accent)', opacity: 0.4 }}
          />
        </React.Fragment>
      ))}
    </span>
  );
}

export function TickerTape() {
  // refetchInterval override at the call site — the frozen query factory is untouched.
  const { data } = useQuery({ ...latestQuery(), refetchInterval: POLL.market.live });

  // Deterministic placeholder until the first fetch resolves: the build-time HTML
  // and first client render must match, so no data-derived output here.
  if (!data) {
    return (
      <div className="h-8 flex items-center gap-4 px-4" aria-hidden="true">
        <span className="skeleton h-3 w-28" />
        <span className="skeleton h-3 w-24" />
        <span className="skeleton h-3 w-28" />
      </div>
    );
  }

  const items: TickerItem[] = [
    // VIX is already an entry in indices — no separate market_summary.vix item.
    ...data.market_summary.indices.map((idx) => ({
      label: idx.ticker,
      value: formatNumber(idx.price, idx.price >= 1000 ? 0 : 2),
      changePct: idx.change_pct,
    })),
    ...data.market_summary.fx_rates.map((fx) => ({
      label: fx.pair,
      value: formatNumber(fx.price, 4),
    })),
  ];

  return (
    <div className="ticker-mask h-8 flex items-center" aria-label="Live market indices">
      <div className="ticker-track">
        <TickerRun items={items} />
        <TickerRun items={items} dupe />
      </div>
    </div>
  );
}
