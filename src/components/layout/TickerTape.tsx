// components/layout/TickerTape.tsx — live index marquee fed by latestQuery
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { latestQuery } from '@/lib/query/options';
import { POLL } from '@/lib/query/policy';
import { formatNumber, formatPercent } from '@/lib/format';
import { lookup } from '@/lib/glossary';

// Two entries in the tape are not prices at all — VIX is a volatility gauge and
// "10Y Yield" is an interest rate — but they scroll past looking identical to
// "S&P 500 7,512.25". A native `title` is deliberate here rather than <InfoTip>:
// the strip is 32px tall with `overflow: hidden`, so a popover tooltip would be
// clipped, and the duplicated marquee run is aria-hidden, so putting focusable
// buttons in it would trap the keyboard on invisible copies. The tape pauses on
// hover (globals.css), so the native tooltip is reachable.
const TAPE_TERMS: Record<string, string> = {
  VIX: 'vix',
  '10Y Yield': 'ten_year_yield',
};

function tapeHint(label: string): string | undefined {
  const term = TAPE_TERMS[label];
  const base = term ? lookup(term)?.plain : undefined;
  if (!base) return undefined;
  // BUG FIX: change_pct on every entry in market_summary.indices is a
  // relative percent change of that entry's own value, same as every other
  // index here (an archived reading of ten_year_yield 4.6 with change_pct
  // 1.32 would be a ~132pp one-day move read as points — essentially
  // impossible for a bond yield, but a plausible ~0.06pp move read as a
  // relative percent). That's the normal meaning for a price ("S&P 500 up
  // 0.04%"), but "10Y Yield" is already itself a percentage, so the same
  // math applied to it produces a confusing result: "▲ +0.22%" beside
  // "4.64%" reads like the rate jumped 0.22 percentage points (to 4.86%),
  // when it actually means the 4.64 moved by 0.22% of itself (about 0.01
  // points). Spell that out since the tape strip has no room to show it
  // inline.
  if (label === '10Y Yield') {
    return `${base} The % change shown is a relative move in the yield itself, not a move in percentage points.`;
  }
  return base;
}

interface TickerItem {
  label: string;
  value: string;
  changePct?: number;
}

function TickerEntry({ item }: { item: TickerItem }) {
  const hasDelta = item.changePct !== undefined;
  const up = hasDelta && item.changePct! > 0;
  const down = hasDelta && item.changePct! < 0;
  const hint = tapeHint(item.label);

  return (
    <span className="inline-flex items-baseline gap-2 whitespace-nowrap" title={hint}>
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
      // BUG FIX: "10Y Yield" is a pseudo-index — its `price` field IS the
      // yield itself (already a percentage rate), not a price level. The
      // generic index-level formatting dropped the %, so it read as a bare
      // "4.64" next to real index points in the thousands. The archive page
      // prints this same field as "4.64%" — match that here.
      value: idx.ticker === '10Y Yield'
        ? `${formatNumber(idx.price, 2)}%`
        : formatNumber(idx.price, idx.price >= 1000 ? 0 : 2),
      changePct: idx.change_pct,
    })),
    ...data.market_summary.fx_rates.map((fx) => ({
      label: fx.pair,
      value: formatNumber(fx.price, 4),
    })),
  ];

  // "data", not "prices": the strip mixes several kinds of number — index
  // levels, a volatility gauge (VIX), an interest rate ("10Y Yield") and an
  // exchange rate (USD/CAD). This label is the only description a screen reader
  // gives the whole strip, so it must not call a 4.64% borrowing rate a price.
  return (
    <div className="ticker-mask h-8 flex items-center" aria-label="Live market data">
      <div className="ticker-track">
        <TickerRun items={items} />
        <TickerRun items={items} dupe />
      </div>
    </div>
  );
}
