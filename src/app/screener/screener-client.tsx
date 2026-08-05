// app/screener/screener-client.tsx — full-featured port of the legacy screener:
// multi-factor filters, sortable table, Finviz-style treemap, gated full data
// (Basic) with the public 8-row teaser for visitors.
'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { screenerQuery } from '@/lib/query/options';
import { GateCard } from '@/components/feature/gating/GateCard';
import { InfoTip, PlainLabel, DensityToggle } from '@/components/primitives';
import {
  INDEX_UNIVERSES,
  WATCHLIST_UNIVERSES,
  tickerInUniverse,
  tickerUniverses,
  universesInData,
  type ScreenerTicker,
} from '@/lib/schemas/screener';
import { ScoreBreakdown } from '@/components/feature/screener/ScoreBreakdown';
import { isBearishSignal, signalLabel } from '@/lib/screener/score';
import { hrefForSymbol } from '@/lib/ticker/href';

/* Build-time set of symbols that have a prerendered /ticker/[symbol]/ page.
   Supplied by the server component; a Set in context rather than a prop so the
   table, the treemap and the expanded detail panel all resolve links the same
   way. Empty set = nothing is prerendered, so every link takes the ?symbol=
   route, which still works. */
const CoverageContext = React.createContext<ReadonlySet<string>>(new Set());
const useTickerHref = () => {
  const covered = React.useContext(CoverageContext);
  return (symbol: string) => hrefForSymbol(symbol, covered);
};

/* ------------------------------------------------------------------ */
/*  Filter model                                                      */
/* ------------------------------------------------------------------ */

type Filters = {
  search: string;
  pe: string;
  mcap: string;
  div: string;
  rsi: string;
  universe: string;
  sector: string;
  volume: string;
  w52: string;
  sma: string;
  // The original Strategy/Direction filters compared against `t.signal`
  // (singular) and `t.direction`, neither of which
  // pi-scripts/generate-screener-data.py ever emits (it writes only the
  // plural `signals` array and `recommendation`) — both always returned zero
  // rows against every real data file. See DATA-BUGS-2026-07-22.md for the
  // trace. Replaced below with filters wired to the fields the generator
  // actually writes.
  signal: string;
  recommendation: string;
  scoreMin: number;
  scoreMax: number;
};

const DEFAULT_FILTERS: Filters = {
  search: '',
  pe: '',
  mcap: '',
  div: '',
  rsi: '',
  universe: '',
  sector: '',
  volume: '',
  w52: '',
  sma: '',
  signal: '',
  recommendation: '',
  scoreMin: 0,
  scoreMax: 10,
};

type SortKey = 'ticker' | 'change' | 'score' | 'rsi' | 'mcap' | 'pe' | 'volume_ratio' | 'div';
type Sort = { key: SortKey; dir: 'asc' | 'desc' };
type StoredPreset = { name: string; filters: Filters };

const PRESET_KEY = 'mg-screener-presets';

const inRange = (value: number | null | undefined, filter: string) => {
  if (!filter) return true;
  if (value == null) return false;
  const [lo, hi] = filter.split('-');
  if (lo !== '' && value < parseFloat(lo)) return false;
  if (hi !== '' && hi !== undefined && value > parseFloat(hi)) return false;
  return true;
};

const volRatio = (t: ScreenerTicker) => t.volume_ratio ?? t.vol_ratio ?? null;

function applyFilters(tickers: ScreenerTicker[], f: Filters): ScreenerTicker[] {
  const search = f.search.toLowerCase().trim();

  return tickers.filter((t) => {
    if (
      search &&
      !t.ticker.toLowerCase().includes(search) &&
      !(t.name || '').toLowerCase().includes(search)
    )
      return false;
    if (!inRange(t.pe, f.pe)) return false;
    if (f.sector && t.sector !== f.sector) return false;
    // Universe and sector are independent filters — the old code skipped the
    // universe test entirely whenever a sector was chosen, so "Technology in
    // the Nasdaq-100" silently returned every Technology name in the scan.
    // Membership is now multi-valued (tickerInUniverse), because a ticker
    // genuinely belongs to more than one index at a time.
    if (f.universe && !tickerInUniverse(t, f.universe)) return false;
    const score = t.score ?? 0;
    if (score < f.scoreMin || score > f.scoreMax) return false;
    if (f.signal && !(t.signals || []).includes(f.signal)) return false;
    if (f.mcap) {
      // Was (t.marketCap ?? 0) / 1e9, which silently coerced a MISSING
      // market cap to 0 and dropped the row into the smallest bucket
      // ("Under 2 billion") as if that were a measured value. A row with no
      // market-cap data now falls out of every explicit bucket instead.
      if (t.marketCap == null) return false;
      const b = t.marketCap / 1e9;
      if (f.mcap === '0-2B' && b > 2) return false;
      if (f.mcap === '2B-10B' && (b < 2 || b > 10)) return false;
      if (f.mcap === '10B-200B' && (b < 10 || b > 200)) return false;
      if (f.mcap === '200B-' && b < 200) return false;
      if (f.mcap === '1T-' && b < 1000) return false;
    }
    if (!inRange(t.rsi, f.rsi)) return false;
    if (!inRange(t.divYield, f.div)) return false;
    if (f.volume) {
      const vr = volRatio(t) ?? 0;
      if (f.volume === 'above' && vr < 1) return false;
      if (f.volume === 'below' && vr >= 1) return false;
      if (f.volume === '1.5x' && vr < 1.5) return false;
      if (f.volume === '2x' && vr < 2) return false;
    }
    if (f.recommendation && (t.recommendation || 'none') !== f.recommendation) return false;
    if (f.w52) {
      const hi = t.above_52w_high_pct;
      const lo = t.below_52w_low_pct;
      if (f.w52 === 'near-high' && (hi == null || hi > 5)) return false;
      if (f.w52 === 'near-low' && (lo == null || lo > 5)) return false;
      if (f.w52 === 'mid-range') {
        if (hi == null || lo == null) return false;
        if (hi < 10 && lo < 10) return false;
      }
    }
    if (f.sma) {
      const a20 = !!t.above_sma20;
      const a50 = !!t.above_sma50;
      if (f.sma === 'above-both' && !(a20 && a50)) return false;
      if (f.sma === 'below-both' && !(!a20 && !a50)) return false;
      if (f.sma === 'golden-cross' && !(a50 && !a20)) return false;
      if (f.sma === 'death-cross' && !(!a50 && a20)) return false;
    }
    return true;
  });
}

function sortTickers(list: ScreenerTicker[], sort: Sort): ScreenerTicker[] {
  const dir = sort.dir === 'asc' ? 1 : -1;
  const val = (t: ScreenerTicker): number | string => {
    switch (sort.key) {
      case 'ticker': return t.ticker;
      case 'change': return t.change_pct ?? 0;
      case 'score': return t.score ?? 0;
      case 'rsi': return t.rsi ?? 0;
      case 'mcap': return t.marketCap ?? 0;
      case 'pe': return t.pe ?? (sort.dir === 'asc' ? Infinity : 0);
      case 'volume_ratio': return volRatio(t) ?? 0;
      // Div% was the only numeric column with no sortKey wired to its
      // HeaderCell, so clicking it did nothing while every other header
      // sorted. Added for consistency with the rest of the table.
      case 'div': return t.divYield ?? 0;
    }
  };
  return [...list].sort((a, b) => {
    const va = val(a);
    const vb = val(b);
    if (typeof va === 'string' || typeof vb === 'string')
      return String(va).localeCompare(String(vb)) * dir;
    return (va - vb) * dir;
  });
}

/* ------------------------------------------------------------------ */
/*  Small display helpers                                             */
/* ------------------------------------------------------------------ */

const fmtPrice = (v: number | null | undefined, d = 2) =>
  v == null ? '—' : v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const fmtPct = (v: number | null | undefined) =>
  v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const changeColor = (v: number | null | undefined) =>
  (v ?? 0) > 0 ? 'var(--color-bull)' : (v ?? 0) < 0 ? 'var(--color-bear)' : 'var(--color-text-secondary)';

// Was always divided by 1e9 and suffixed "B", so a $4T mega-cap (the full
// 659-ticker universe spans well past that) rendered as "4000.0B" instead of
// switching to trillions. Note this does NOT fix the separate currency issue:
// marketCap carries no currency field, so TSX (.TO) rows report CAD figures
// through the same number as USD rows with no way to tell them apart from
// this file alone — that needs a currency field from the generator.
const fmtMarketCap = (v: number | null | undefined) => {
  if (v == null) return '—';
  return v >= 1e12 ? `${fmtPrice(v / 1e12, 2)}T` : `${fmtPrice(v / 1e9, 1)}B`;
};

// The signal vocabulary, its plain-English labels and which rules subtract
// from the score all live in @/lib/screener/score — one table shared with the
// expandable "Why this score" panel, so the chips in this row and the
// breakdown under it can never describe the same rule differently.
//
// `isBearishSignal` derives its answer from each rule's point value rather
// than pattern-matching the tag name: an earlier substring test (/over|.../)
// matched inside "oversold_rsi" and painted RSI < 35 — the single largest
// BULLISH contributor — red.

/* ------------------------------------------------------------------ */
/*  UI atoms                                                          */
/* ------------------------------------------------------------------ */

const selectCls =
  'w-full rounded-lg border bg-[var(--color-bg-elevated)] px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
const selectStyle = { borderColor: 'var(--color-border-subtle)' } as const;

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 min-w-0">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
        {label}
      </span>
      {/* mt-auto keeps every control on a grid row bottom-aligned even when a
          label carries a plain-English subtitle and runs to two lines. */}
      <span className="mt-auto block">{children}</span>
    </label>
  );
}

// `caption` is optional, small print under the value. Added so a stat that is
// computed on the Pi across the whole scanned universe — and does not move
// when the user changes the filters below — can say so, instead of sitting
// next to a filtered, sortable table with no denominator or scope note at all.
function StatCard({
  label,
  value,
  color,
  caption,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  color?: string;
  caption?: string;
}) {
  return (
    <div
      className="rounded-[var(--radius-tile)] border p-4"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold text-[var(--color-text-primary)]" data-numeric style={color ? { color } : undefined}>
        {value}
      </p>
      {caption && (
        <p className="mt-1 text-[11px] leading-snug text-[var(--color-text-tertiary)]">{caption}</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Table                                                             */
/* ------------------------------------------------------------------ */

/* Column visibility by breakpoint — one map shared by the header row and
   TickerRow so the two can never drift. Core columns always render; the rest
   earn their space as the viewport grows (mobile keeps ticker/price/chg/score
   instead of forcing an 11-column horizontal scroll). */
const COL = {
  ticker: '',
  price: '',
  change: '',
  score: '',
  pe: 'hidden lg:table-cell',
  mcap: 'hidden lg:table-cell',
  div: 'hidden lg:table-cell',
  rsi: 'hidden sm:table-cell',
  volRatio: 'hidden sm:table-cell',
  sector: 'hidden lg:table-cell',
  signals: 'hidden xl:table-cell',
} as const;

function HeaderCell({
  label,
  sortKey,
  sort,
  onSort,
  align = 'left',
  className = '',
}: {
  label: React.ReactNode;
  sortKey?: SortKey;
  sort: Sort;
  onSort: (k: SortKey) => void;
  align?: 'left' | 'right' | 'center';
  className?: string;
}) {
  const active = sortKey && sort.key === sortKey;
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th
      className={`text-[10px] font-medium uppercase tracking-[0.14em] whitespace-nowrap ${alignCls} ${className} ${sortKey ? 'cursor-pointer select-none hover:text-[var(--color-text-primary)]' : ''}`}
      style={{ color: active ? 'var(--color-accent)' : 'var(--color-text-tertiary)' }}
      // A header that carries an InfoTip contains a real <button>. Without this
      // guard its click bubbles up and re-sorts the table, so on a touch device
      // — where tapping is the only way to open a tooltip — a beginner could not
      // read a definition without scrambling the column order.
      onClick={
        sortKey
          ? (e) => {
              if ((e.target as HTMLElement).closest('button')) return;
              onSort(sortKey);
            }
          : undefined
      }
      aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
    >
      {label}
      {active && <span aria-hidden="true"> {sort.dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );
}

/* ------------------------------------------------------------------ */
/*  Expanded per-ticker detail                                        */
/* ------------------------------------------------------------------ */

/** One labelled reading in the detail panel. Renders nothing when absent. */
function Fact({ label, value, note }: { label: React.ReactNode; value: React.ReactNode; note?: string }) {
  if (value == null || value === '' || value === '—') return null;
  return (
    <div className="min-w-0 p-3" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-[var(--color-text-primary)]" data-numeric>{value}</dd>
      {note && <p className="mt-0.5 text-[10px] leading-snug text-[var(--color-text-tertiary)]">{note}</p>}
    </div>
  );
}

function DetailPanel({ t }: { t: ScreenerTicker }) {
  const tickerHref = useTickerHref();
  const vr = volRatio(t);
  const universes = tickerUniverses(t);
  // The trap documented in generate-screener-data.py: above_52w_high_pct is
  // the distance BELOW the high, below_52w_low_pct the distance ABOVE the low.
  const belowHigh = t.above_52w_high_pct;
  const aboveLow = t.below_52w_low_pct;

  return (
    <div className="space-y-4 p-4" style={{ backgroundColor: 'var(--color-bg-base)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]" data-numeric>
            {t.ticker}
            {t.name && <span className="ml-2 font-normal text-[var(--color-text-secondary)]">{t.name}</span>}
          </h3>
          {(t.sector || t.industry) && (
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              {[t.sector, t.industry].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <Link
          href={tickerHref(t.ticker)}
          className="text-xs font-semibold text-[var(--color-accent)] hover:underline"
        >
          Full company page →
        </Link>
      </div>

      <section>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Why this score
        </h4>
        <ScoreBreakdown ticker={t} />
      </section>

      <section>
        <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-text-tertiary)]">
          Every reading in this snapshot
        </h4>
        <dl
          className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border sm:grid-cols-3 lg:grid-cols-4"
          style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-border-subtle)' }}
        >
          <Fact label="Price" value={t.price != null ? `$${fmtPrice(t.price)}` : null} />
          <Fact
            label="Change"
            value={fmtPct(t.change_pct)}
            note="Against the previous close, not the open"
          />
          <Fact label={<InfoTip term="rsi">RSI (14)</InfoTip>} value={t.rsi != null ? t.rsi.toFixed(1) : null} />
          <Fact
            label={<InfoTip term="sma_20">20-day average</InfoTip>}
            value={t.sma20 != null ? `$${fmtPrice(t.sma20)}` : null}
            note={t.above_sma20 == null ? undefined : t.above_sma20 ? 'Price is above it' : 'Price is below it'}
          />
          <Fact
            label={<InfoTip term="sma_50">50-day average</InfoTip>}
            value={t.sma50 != null ? `$${fmtPrice(t.sma50)}` : null}
            note={t.above_sma50 == null ? undefined : t.above_sma50 ? 'Price is above it' : 'Price is below it'}
          />
          <Fact
            label="52-week high"
            value={t.high52w != null ? `$${fmtPrice(t.high52w)}` : null}
            note={belowHigh != null ? `Price is ${belowHigh.toFixed(1)}% below it` : undefined}
          />
          <Fact
            label="52-week low"
            value={t.low52w != null ? `$${fmtPrice(t.low52w)}` : null}
            note={aboveLow != null ? `Price is ${aboveLow.toFixed(1)}% above it` : undefined}
          />
          <Fact
            label="Volume vs average"
            value={vr != null ? `${vr.toFixed(2)}×` : null}
            note={
              t.volume != null && t.avgVolume != null
                ? `${Math.round(t.volume).toLocaleString('en-US')} traded vs ${Math.round(t.avgVolume).toLocaleString('en-US')} on a typical day`
                : undefined
            }
          />
          <Fact label={<InfoTip term="market_cap">Market cap</InfoTip>} value={fmtMarketCap(t.marketCap)} />
          <Fact
            label={<InfoTip term="p_e">P/E</InfoTip>}
            value={t.pe != null ? t.pe.toFixed(1) : null}
            note={t.forwardPe != null ? `${t.forwardPe.toFixed(1)} using next year's forecast earnings` : undefined}
          />
          <Fact
            label={<InfoTip term="div_yield">Dividend yield</InfoTip>}
            value={t.divYield != null && t.divYield > 0 ? `${t.divYield.toFixed(2)}%` : null}
          />
          <Fact
            label={<InfoTip term="beta">Beta</InfoTip>}
            value={t.beta != null ? t.beta.toFixed(2) : null}
            note="How much it tends to move when the market moves 1%"
          />
          <Fact
            label={<InfoTip term="analyst_ratings">Analyst rating</InfoTip>}
            value={t.recommendation ? String(t.recommendation).replace(/_/g, ' ') : null}
          />
          <Fact
            label="Analyst price target"
            value={t.targetPrice != null ? `$${fmtPrice(t.targetPrice)}` : null}
            note="Average of the analysts' 12-month forecasts — an opinion, not a projection we make"
          />
          <Fact
            label="Held by institutions"
            value={t.institutionPct != null ? `${t.institutionPct.toFixed(1)}%` : null}
            note="Share of the company owned by funds and other large investors"
          />
          <Fact
            label="Index membership"
            value={universes.length ? universes.join(', ') : null}
            note="Not part of the score"
          />
        </dl>
        {/* marketCap carries no currency field, so a .TO row reports CAD
            through the same number as a USD row. Say so rather than let the
            two be compared as if they were the same unit. */}
        {t.ticker.endsWith('.TO') && (
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
            This is a Toronto listing, so its price and market cap are in Canadian dollars while the US rows are in US
            dollars. The scan does not record which currency a figure is in, so the two are not directly comparable.
          </p>
        )}
      </section>
    </div>
  );
}

function TickerRow({
  t,
  expanded,
  onToggle,
  detailId,
}: {
  t: ScreenerTicker;
  expanded: boolean;
  onToggle: () => void;
  detailId: string;
}) {
  const tickerHref = useTickerHref();
  const score = t.score ?? 0;
  const vr = volRatio(t);
  const rsi = t.rsi;

  return (
    <>
    <tr
      className="border-t transition-colors hover:bg-[var(--color-bg-elevated)]"
      style={{
        borderColor: 'var(--color-border-subtle)',
        backgroundColor: expanded ? 'var(--color-bg-elevated)' : undefined,
      }}
    >
      <td className={COL.ticker}>
        <span className="flex items-center gap-1">
          {/* The toggle lives inside the ticker cell rather than in a 12th
              column: the table already drops to four columns on mobile, and a
              dedicated control column would eat one of them. */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={`${expanded ? 'Hide' : 'Show'} details for ${t.ticker}`}
            className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-[var(--color-text-tertiary)] transition-colors hover:text-[var(--color-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
          >
            <svg
              viewBox="0 0 20 20" width="12" height="12" fill="none" stroke="currentColor"
              strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
              style={{ transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 120ms' }}
            >
              <path d="m7 4 6 6-6 6" />
            </svg>
          </button>
          <Link
            href={tickerHref(t.ticker)}
            className="font-semibold text-[var(--color-accent)] hover:underline"
            data-numeric
          >
            {t.ticker}
          </Link>
        </span>
      </td>
      <td className={`${COL.price} text-right text-[var(--color-text-primary)]`} data-numeric>
        {fmtPrice(t.price)}
      </td>
      <td className={`${COL.change} text-right font-medium`} data-numeric style={{ color: changeColor(t.change_pct) }}>
        {fmtPct(t.change_pct)}
      </td>
      <td className={`${COL.score} text-center`}>
        <span
          className="inline-block rounded px-1.5 py-0.5 font-bold"
          data-numeric
          style={{
            backgroundColor: `color-mix(in srgb, var(--color-bull) ${Math.round(12 + (score / 10) * 35)}%, transparent)`,
            color: 'var(--color-text-primary)',
          }}
        >
          {/* compute_score() in generate-screener-data.py always returns a
              whole number clamped to 1-10, so toFixed(1) was printing a false
              "8.0" that reads as a continuous scale. Round-trip through an
              integer to display it as the whole number it always is. */}
          {Math.round(score)}
        </span>
      </td>
      <td className={`${COL.pe} text-right text-[var(--color-text-secondary)]`} data-numeric>
        {t.pe != null ? t.pe.toFixed(1) : '—'}
      </td>
      <td className={`${COL.mcap} text-right text-[var(--color-text-secondary)]`} data-numeric>
        {fmtMarketCap(t.marketCap)}
      </td>
      <td className={`${COL.div} text-right text-[var(--color-text-secondary)]`} data-numeric>
        {t.divYield != null && t.divYield > 0 ? `${t.divYield.toFixed(2)}%` : '—'}
      </td>
      <td
        className={`${COL.rsi} text-right font-medium`}
        data-numeric
        // Was rsi < 30 -> bear-red, rsi > 70 -> bull-green — backwards from
        // compute_score(), which treats RSI under 35 (oversold_rsi) as its
        // single largest BULLISH input and anything over 65 (extended_rsi /
        // overbought_rsi) as bearish. Thresholds and colours now match the
        // score's own bands (see SIGNAL_LABELS above) instead of contradicting
        // the "Why This Score" chips in the last column of this same row.
        style={{
          color: rsi == null ? 'var(--color-text-secondary)' : rsi < 35 ? 'var(--color-bull)' : rsi > 65 ? 'var(--color-bear)' : 'var(--color-text-secondary)',
        }}
      >
        {rsi != null ? rsi.toFixed(1) : '—'}
      </td>
      <td
        className={`${COL.volRatio} text-right`}
        data-numeric
        style={{ color: vr != null && vr > 2 ? 'var(--color-accent)' : 'var(--color-text-secondary)', fontWeight: vr != null && vr > 2 ? 700 : undefined }}
      >
        {vr != null ? `${vr.toFixed(2)}x` : '—'}
      </td>
      <td className={`${COL.sector} text-xs text-[var(--color-text-tertiary)] whitespace-nowrap`}>
        {t.sector ? t.sector.substring(0, 14) : '—'}
      </td>
      <td className={COL.signals}>
        <div className="flex flex-wrap gap-1 max-w-[220px]">
          {(t.signals || []).map((s) => {
            const bearish = isBearishSignal(s);
            return (
              <span
                key={s}
                className="rounded-full px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap"
                style={{
                  backgroundColor: bearish ? 'var(--color-bear-soft)' : 'var(--color-bull-soft)',
                  color: bearish ? 'var(--color-bear)' : 'var(--color-bull)',
                }}
              >
                {signalLabel(s)}
              </span>
            );
          })}
          {!t.signals?.length && <span className="text-[var(--color-text-tertiary)]">—</span>}
        </div>
      </td>
    </tr>
    {expanded && (
      <tr id={detailId} style={{ borderColor: 'var(--color-border-subtle)' }}>
        {/* colSpan covers every column at every breakpoint — the hidden ones
            still count, so a fixed 11 is correct here. Padding sits on the
            inner div because .mg-table td has its own padding rule. */}
        <td colSpan={11} className="p-0">
          <DetailPanel t={t} />
        </td>
      </tr>
    )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Treemap                                                           */
/* ------------------------------------------------------------------ */

function Treemap({ tickers }: { tickers: ScreenerTicker[] }) {
  const tickerHref = useTickerHref();
  if (!tickers.length) {
    return (
      <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">
        No tickers match your filters.
      </p>
    );
  }

  const hasVolume = tickers.some((t) => (t.volume ?? 0) > 0);
  const totalVolume = hasVolume
    ? tickers.reduce((s, t) => s + Math.max(1, t.volume ?? 1), 0)
    : tickers.length * 100;
  const gridCols = Math.max(8, Math.min(40, Math.ceil(Math.sqrt(tickers.length * 2))));
  const changes = tickers.map((t) => t.change_pct ?? 0);
  const maxPos = Math.max(0.01, ...changes.filter((c) => c > 0));
  const maxNeg = Math.min(-0.01, ...changes.filter((c) => c < 0));

  return (
    <div>
      {/* Two captions because the tiles are only sized by volume when the scan
          carried volume figures; with hasVolume false every tile is identical
          and a size explanation would be describing something that is not
          there. Sizes are coarse either way — the span is a clamped 1–4 by 1–3
          step, so most names land on the smallest tile. */}
      <p className="px-3 pt-3 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        One tile per ticker.{' '}
        {hasVolume
          ? 'Tiles step up in size the more shares a name traded in this snapshot — that is trading activity, not how big the company is — so most sit at the smallest size and only unusually busy names stand out. Colour'
          : 'This scan carried no volume figures, so every tile is the same size. Colour'}{' '}
        shows how far the price moved, green for up and red for down. Shading is relative to the biggest
        move currently on screen, so it shifts as you change the filters.
      </p>
      <div className="grid gap-px p-2" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {tickers.map((t) => {
          const chg = t.change_pct ?? 0;
          const pos = chg >= 0;
          const vol = hasVolume ? Math.max(1, t.volume ?? 1) : 100;
          const ratio = vol / totalVolume;
          const colSpan = Math.max(1, Math.min(4, Math.ceil(ratio * tickers.length * 0.8)));
          const rowSpan = Math.max(1, Math.min(3, Math.ceil(ratio * tickers.length * 0.4)));
          const intensity = pos ? Math.min(1, chg / maxPos) : Math.min(1, Math.abs(chg) / Math.abs(maxNeg));
          const mix = Math.round(15 + intensity * 60);

          return (
            <Link
              key={t.ticker}
              href={tickerHref(t.ticker)}
              className="flex min-h-11 flex-col items-center justify-center overflow-hidden rounded-sm p-1 text-center transition hover:scale-[1.03] hover:z-10"
              style={{
                gridColumn: `span ${colSpan}`,
                gridRow: `span ${rowSpan}`,
                backgroundColor: `color-mix(in srgb, ${pos ? 'var(--color-bull)' : 'var(--color-bear)'} ${mix}%, var(--color-bg-surface))`,
              }}
              // Score is always a whole 1-10 (see TickerRow); RSI genuinely
              // carries a fractional reading, so only score's formatting
              // changes here.
              title={`${t.ticker} · ${fmtPct(chg)} · score ${Math.round(t.score ?? 0)}${t.rsi != null ? ` · RSI ${t.rsi.toFixed(1)}` : ''}`}
            >
              <span className="text-[11px] font-bold leading-tight text-[var(--color-text-primary)]" data-numeric>
                {t.ticker}
              </span>
              <span className="text-[10px] leading-tight text-[var(--color-text-secondary)]" data-numeric>
                {fmtPct(chg)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function ScreenerClient({ tickerCoverage = [] }: { tickerCoverage?: string[] }) {
  // Symbols with a prerendered /ticker/[symbol]/ page, from the build. The
  // screener can list far more rows than there are detail pages — the two are
  // produced by different Pi jobs — so links are resolved per symbol.
  const covered = useMemo(() => new Set(tickerCoverage), [tickerCoverage]);
  return (
    <CoverageContext.Provider value={covered}>
      <ScreenerBody />
    </CoverageContext.Provider>
  );
}

function ScreenerBody() {
  const { data: result, isLoading } = useQuery(screenerQuery());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<Sort>({ key: 'score', dir: 'desc' });
  const [view, setView] = useState<'table' | 'treemap'>('table');
  const [presets, setPresets] = useState<StoredPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());

  const toggleExpanded = (ticker: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (!next.delete(ticker)) next.add(ticker);
      return next;
    });

  useEffect(() => {
    const saved = localStorage.getItem('mg-screener-view');
    if (saved === 'treemap' || saved === 'table') setView(saved);
    try {
      const stored = JSON.parse(localStorage.getItem(PRESET_KEY) || '[]');
      if (Array.isArray(stored)) setPresets(stored.filter((item) => item?.name && item?.filters));
    } catch {}
  }, []);

  const setViewPersist = (v: 'table' | 'treemap') => {
    setView(v);
    localStorage.setItem('mg-screener-view', v);
  };

  const set = <K extends keyof Filters>(k: K, v: Filters[K]) =>
    setFilters((f) => ({ ...f, [k]: v }));

  const persistPresets = (next: StoredPreset[]) => {
    setPresets(next);
    localStorage.setItem(PRESET_KEY, JSON.stringify(next));
  };

  const savePreset = () => {
    const name = presetName.trim();
    if (!name) return;
    persistPresets([...presets.filter((preset) => preset.name !== name), { name, filters }]);
    setPresetName('');
  };

  const data = result?.data ?? null;
  const allTickers = useMemo(() => data?.tickers ?? [], [data]);
  const sectors = useMemo(
    () => [...new Set(allTickers.map((t) => t.sector).filter((s): s is string => !!s))].sort(),
    [allTickers],
  );
  const filtered = useMemo(
    () => sortTickers(applyFilters(allTickers, filters), sort),
    [allTickers, filters, sort],
  );

  const onSort = (key: SortKey) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));

  const ms = data?.market_summary;
  const isLite = result?.mode === 'lite';

  // Which universes this snapshot can answer for. Offering an index the scan
  // never covered and letting it return an empty table would read as "no
  // stocks in that index qualify", which is a different — and false — claim.
  // `null` means the snapshot cannot say (see universesInData) — then no
  // coverage claim is made either way.
  const scanned = useMemo(() => universesInData(data), [data]);
  const coverageNote = (name: string) => (scanned && !scanned.has(name) ? ' — not in this scan' : '');
  const universeUnscanned = !!filters.universe && !!scanned && !scanned.has(filters.universe);
  // Are the loaded rows a SAMPLE of the scan rather than all of it? Derived
  // from the row count, deliberately NOT from `scanned` being unknown: once the
  // generator starts writing `universes_scanned`, the public teaser will carry
  // an authoritative coverage list alongside its 8 rows. Picking a universe
  // that WAS scanned but happens to have no row among those 8 would then show
  // an unexplained empty table — no "not in this scan" banner, because it was
  // scanned, and no sample note either. This keeps the sample caveat tied to
  // the thing that actually causes it.
  const isSample = allTickers.length < (data?.ticker_count ?? allTickers.length);
  const universeSource = filters.universe ? data?.universe_sources?.[filters.universe] : undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div
        className="relative rounded-[var(--radius-tile)] border p-6"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        {/* The clipping that used to live on the card itself now wraps only the
            decorative orb. Same look — the orb is still cut to the rounded card
            — but the card no longer swallows the glossary tooltips in the
            paragraph below, which are taller than the card and were being
            clipped away to nothing in Learning Mode. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-tile)]"
        >
          <span className="glow-orb -top-24 -right-8" />
        </span>
        <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
          Stock <em className="italic" style={{ color: 'var(--color-accent)' }}>Screener</em>
        </h1>
        <p className="relative z-10 mt-2 text-sm text-[var(--color-text-secondary)]">
          Filter and sort the stocks and funds we scan. The Universe filter covers five stock market indexes — the
          S&amp;P 500, 400 and 600, the Nasdaq-100 and the Russell 2000 — plus the TSX 60 and our tech-and-growth,
          high-dividend and fixed-income-and-commodities watchlists; any the latest run didn&apos;t cover is marked in
          the list. Looking up one company you already have in mind is a{' '}
          <Link href="/ticker/" className="font-medium text-[var(--color-accent)] hover:underline">separate page</Link>.
          {isLite ? ' The public preview below shows the eight highest-scoring names. ' : ' '}
          {/* Six, not five: the analyst-rating check used to compare against
              uppercase literals while the source ships lowercase, so it never
              fired and only five checks could contribute. That comparison is
              fixed in generate-screener-data.py, so the sixth now counts. */}
          Each name carries a 1–10 score built from six checks: its{' '}
          <InfoTip term="rsi">RSI</InfoTip> reading, its price against the 20- and
          50-day average prices, how heavily it traded, where it sits in its 52-week range, its{' '}
          <InfoTip term="p_e">price-to-earnings ratio</InfoTip>, and what{' '}
          <InfoTip term="analyst_ratings">analysts</InfoTip> rate it. Rebuilt each trading day from a snapshot
          taken during market hours — so these are neither live prices nor closing prices — and the same
          snapshot stays up until the next run, so check the timestamp under the results for when it was
          taken. Open any row with the arrow beside its symbol to see how its score was arrived at, check
          by check.
        </p>
      </div>

      {/* Lite-mode gate banner */}
      {isLite && result && (
        <GateCard
          kind={result.gate}
          need={result.need ?? 'basic'}
          feature="The full Screener"
        />
      )}

      {/* Summary stats. Avg Score / Up / Down on the Day are precomputed on
          the Pi across the entire scanned universe (market_summary) — they
          had no denominator or scope note, so a beginner could easily read
          them as describing the filtered table beneath, when they neither
          respond to any filter here nor (in the public preview) describe
          rows the visitor can even see. Captions below make the scope
          explicit instead of leaving it to a code comment nobody reads. */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Scanned" value={data?.ticker_count ?? '—'} />
        <StatCard
          label={<InfoTip term="score">Avg Score</InfoTip>}
          value={ms?.avg_score != null ? ms.avg_score.toFixed(1) : '—'}
          caption="The average of every scanned stock's 1–10 score — not just the rows below. 5 means neutral, higher is stronger."
        />
        {/* Counts of change_pct > 0 / < 0 in a mid-session snapshot: these names
            are up or down against the previous close, not against a close of
            their own. green_count + red_count need not sum to Scanned — a
            flat (unchanged) ticker counts toward neither. */}
        <StatCard
          label="Up on the Day"
          value={ms?.green_count ?? '—'}
          color="var(--color-bull)"
          caption="All scanned tickers; flat names count in neither"
        />
        <StatCard
          label="Down on the Day"
          value={ms?.red_count ?? '—'}
          color="var(--color-bear)"
          caption="All scanned tickers; flat names count in neither"
        />
      </div>

      {/* Filters */}
      <div
        className="rounded-[var(--radius-tile)] border p-4"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {/* Named "Narrow this list", not "Search": looking a single company
              up is its own page now (/ticker/), and calling both things
              "search" sent people here to type a symbol and then read an
              11-row table as the answer. This box only hides rows. */}
          <Field
            label={
              <>
                Narrow this list
                <span className="mt-0.5 block text-[10px] font-normal normal-case tracking-normal text-[var(--color-text-tertiary)]">
                  Hides rows below
                </span>
              </>
            }
          >
            <input
              type="text"
              value={filters.search}
              onChange={(e) => set('search', e.target.value)}
              placeholder="Ticker or name…"
              className={selectCls}
              style={selectStyle}
            />
          </Field>
          <Field label="Universe">
            <select value={filters.universe} onChange={(e) => set('universe', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">All Universes</option>
              {/* Membership is multi-valued, so these overlap heavily on
                  purpose — nearly every Nasdaq-100 name is also an S&P 500
                  name, and the S&P 600 and Russell 2000 share most of their
                  constituents. A name marked "not in this scan" is one the
                  latest run did not cover; the note under the table explains
                  how to change that rather than leaving an empty result to be
                  misread as "nothing qualifies". */}
              <optgroup label="Stock market indexes">
                {INDEX_UNIVERSES.map((name) => (
                  <option key={name} value={name}>{name}{coverageNote(name)}</option>
                ))}
              </optgroup>
              <optgroup label="Our watchlists">
                {WATCHLIST_UNIVERSES.map((name) => (
                  <option key={name} value={name}>{name}{coverageNote(name)}</option>
                ))}
              </optgroup>
            </select>
          </Field>
          <Field label="Sector">
            <select value={filters.sector} onChange={(e) => set('sector', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">All Sectors</option>
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </Field>
          {/* Subtitles here rather than tooltips: <Field> renders a <label>, and
              InfoTip's <button> would hijack the implicit label association from
              the control. The tooltips for these live on the table headers. */}
          <Field
            label={
              <>
                PE Ratio
                <PlainLabel term="p_e" className="mt-0.5" />
              </>
            }
          >
            <select value={filters.pe} onChange={(e) => set('pe', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">Any</option>
              <option value="0-15">Value (&lt;15)</option>
              <option value="15-25">Moderate (15–25)</option>
              <option value="25-50">Premium (25–50)</option>
              <option value="50-">High (&gt;50)</option>
            </select>
          </Field>
          <Field label="Market Cap">
            <select value={filters.mcap} onChange={(e) => set('mcap', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">Any</option>
              <option value="0-2B">Under 2 billion</option>
              <option value="2B-10B">2–10 billion</option>
              <option value="10B-200B">10–200 billion</option>
              <option value="200B-">Over 200 billion</option>
              <option value="1T-">Over 1 trillion</option>
            </select>
          </Field>
          <Field label="Dividend Yield">
            <select value={filters.div} onChange={(e) => set('div', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">Any</option>
              <option value="0-1">Low (&lt;1%)</option>
              <option value="1-3">Moderate (1–3%)</option>
              <option value="3-">High (&gt;3%)</option>
            </select>
          </Field>
          <Field
            label={
              <>
                RSI
                <PlainLabel term="rsi" className="mt-0.5" />
              </>
            }
          >
            <select value={filters.rsi} onChange={(e) => set('rsi', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">Any</option>
              <option value="0-30">Oversold (&lt;30)</option>
              <option value="30-45">Weak (30–45)</option>
              <option value="45-55">Neutral (45–55)</option>
              <option value="55-70">Strong (55–70)</option>
              <option value="70-">Overbought (&gt;70)</option>
            </select>
          </Field>
          <Field label="Volume vs 50-Day Avg">
            <select value={filters.volume} onChange={(e) => set('volume', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">Any</option>
              <option value="above">Above Average</option>
              <option value="below">Below Average</option>
              <option value="1.5x">1.5x+ Average</option>
              <option value="2x">2x+ Average</option>
            </select>
          </Field>
          <Field label="Price vs 52-Week Range">
            <select value={filters.w52} onChange={(e) => set('w52', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">Any</option>
              <option value="near-high">Within 5% of High</option>
              <option value="near-low">Within 5% of Low</option>
              <option value="mid-range">Not in a Tight Band</option>
            </select>
          </Field>
          <Field
            label={
              <>
                Price vs SMAs
                <PlainLabel term={['sma_20', 'sma_50']} className="mt-0.5" />
              </>
            }
          >
            <select value={filters.sma} onChange={(e) => set('sma', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">Any</option>
              <option value="above-both">Above 20- &amp; 50-Day</option>
              <option value="below-both">Below 20- &amp; 50-Day</option>
              <option value="golden-cross">Above 50-Day, Below 20-Day</option>
              <option value="death-cross">Above 20-Day, Below 50-Day</option>
            </select>
          </Field>
          {/* Options mirror the tag vocabulary generate-screener-data.py emits in
              signals[] — the old Strategy/Direction filters tested fields no
              producer ever wrote, so they always returned zero rows. */}
          <Field label="Signal">
            <select value={filters.signal} onChange={(e) => set('signal', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">All</option>
              <option value="oversold_rsi">Oversold RSI</option>
              <option value="rsi_dip">RSI Dip</option>
              <option value="overbought_rsi">Overbought RSI</option>
              <option value="extended_rsi">Extended RSI</option>
              <option value="above_ma">Above MAs</option>
              <option value="below_ma">Below MAs</option>
              <option value="volume_surge">Volume Surge</option>
              <option value="near_high">Near 52w High</option>
              <option value="near_low">Near 52w Low</option>
              <option value="value_pe">Value P/E</option>
              <option value="premium_pe">Premium P/E</option>
              <option value="analyst_buy">Analyst Buy</option>
              <option value="analyst_sell">Analyst Sell</option>
            </select>
          </Field>
          <Field label="Analyst Rec">
            <select value={filters.recommendation} onChange={(e) => set('recommendation', e.target.value)} className={selectCls} style={selectStyle}>
              <option value="">All</option>
              <option value="strong_buy">Strong Buy</option>
              <option value="buy">Buy</option>
              <option value="none">No Coverage</option>
            </select>
          </Field>
          <Field label="Score Min">
            {/* step was 0.1, implying a continuous scale; compute_score()
                always returns a whole number clamped to 1-10, so whole steps
                match what the field can ever actually equal. */}
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              value={filters.scoreMin}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                set('scoreMin', Number.isFinite(v) ? v : 0);
              }}
              className={selectCls}
              style={selectStyle}
            />
          </Field>
          <Field label="Score Max">
            <input
              type="number"
              min={0}
              max={10}
              step={1}
              value={filters.scoreMax}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                set('scoreMax', Number.isFinite(v) ? v : 10);
              }}
              className={selectCls}
              style={selectStyle}
            />
          </Field>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilters(DEFAULT_FILTERS)}
              className="min-h-9 w-full rounded-lg border px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
              style={{ borderColor: 'var(--color-border-default)' }}
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <input
            value={presetName}
            onChange={(event) => setPresetName(event.target.value)}
            placeholder="Preset name"
            className={`${selectCls} max-w-48`}
            style={selectStyle}
          />
          <button type="button" onClick={savePreset} className="rounded-lg border px-3 py-2 text-sm font-medium" style={{ borderColor: 'var(--color-border-default)' }}>
            Save preset
          </button>
          <select
            defaultValue=""
            onChange={(event) => {
              const preset = presets.find((item) => item.name === event.target.value);
              if (preset) setFilters({ ...DEFAULT_FILTERS, ...preset.filters });
            }}
            className={`${selectCls} max-w-56`}
            style={selectStyle}
            aria-label="Load screener preset"
          >
            <option value="">Load preset…</option>
            {presets.map((preset) => <option key={preset.name} value={preset.name}>{preset.name}</option>)}
          </select>
          {presets.length > 0 && (
            <button type="button" onClick={() => persistPresets([])} className="text-xs text-[var(--color-text-tertiary)] hover:text-[var(--color-bear)]">
              Clear saved presets
            </button>
          )}
        </div>
      </div>

      {/* The other half of the same problem: on a sample this small, an empty
          table proves nothing about the index either way, so the page must not
          imply it does — in either direction. */}
      {isSample && !!filters.universe && !isLoading && allTickers.length > 0 && (
        <div
          className="rounded-[var(--radius-tile)] border p-4"
          style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
        >
          <p className="text-xs leading-relaxed text-[var(--color-text-secondary)]">
            You&apos;re filtering a sample of {allTickers.length} rows out of {data?.ticker_count ?? '—'} scanned, picked
            by score rather than by index. Whatever this shows for the {filters.universe} — including nothing at all —
            isn&apos;t a reading of that index.
          </p>
        </div>
      )}

      {/* An index the latest run did not cover produces an empty table, which
          without this reads as "no stock in that index qualifies" — a claim
          the data cannot support. Say which it is instead. */}
      {universeUnscanned && !isLoading && (
        <div
          className="rounded-[var(--radius-tile)] border p-4"
          style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-caution)' }}
        >
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            The latest scan didn&apos;t {filtered.length ? 'target' : 'cover'} the {filters.universe}
          </p>
          {/* Membership is a property of the company, not of the scan, so an
              unscanned index can still match rows: every S&P 600 name we DID
              scan is also a Russell 2000 name. Claiming "nothing to show" over
              a table with rows in it would be visibly false, so the two cases
              say different things. */}
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-secondary)]">
            {filtered.length ? (
              <>
                The {filtered.length} {filtered.length === 1 ? 'name' : 'names'} below appear only because they also
                belong to an index the scan did cover — they are a fragment of the {filters.universe}, not a reading of
                it, and they were not selected for being in it.
              </>
            ) : (
              <>So there is nothing to show — this is a gap in the data, not a finding about those companies.</>
            )}{' '}
            The scan covers {scanned && scanned.size ? [...scanned].join(', ') : 'no universes it recorded'}.
          </p>
        </div>
      )}

      {/* Results */}
      <div
        className="overflow-hidden rounded-[var(--radius-tile)] border"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <div
          className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5"
          style={{ borderColor: 'var(--color-border-subtle)' }}
        >
          <span className="text-xs text-[var(--color-text-tertiary)]" data-numeric>
            {!isLoading && allTickers.length > 0 ? (
              <>
                {filtered.length} of {data?.ticker_count ?? allTickers.length} tickers
                {isLite && ' — public preview'}
              </>
            ) : (
              'Results'
            )}
          </span>
          <div className="flex items-center gap-2">
          <DensityToggle />
          <div
            className="flex rounded-lg border p-0.5"
            style={{ borderColor: 'var(--color-border-default)' }}
            role="tablist"
            aria-label="View mode"
          >
            {(['table', 'treemap'] as const).map((v) => (
              <button
                key={v}
                type="button"
                role="tab"
                aria-selected={view === v}
                onClick={() => setViewPersist(v)}
                className="rounded-md px-2.5 py-1 text-xs font-semibold capitalize transition"
                style={
                  view === v
                    ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }
                    : { color: 'var(--color-text-secondary)' }
                }
              >
                {v}
              </button>
            ))}
          </div>
          </div>
        </div>
        {isLoading ? (
          <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">Loading the latest scan…</p>
        ) : !allTickers.length ? (
          <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">
            Screener data isn&apos;t available right now.
          </p>
        ) : view === 'treemap' ? (
          <Treemap tickers={filtered} />
        ) : (
          <div className="overflow-x-auto">
            {/* Base width fits the always-on 4 columns; min-widths step up as
                breakpoints reveal more columns (overflow-x stays as safety). */}
            <table className="mg-table w-full sm:min-w-[560px] lg:min-w-[760px] xl:min-w-[900px]">
              <thead>
                <tr>
                  <HeaderCell label="Ticker" sortKey="ticker" sort={sort} onSort={onSort} className={COL.ticker} />
                  <HeaderCell label="Price" align="right" sort={sort} onSort={onSort} className={COL.price} />
                  <HeaderCell label="Chg%" sortKey="change" align="right" sort={sort} onSort={onSort} className={COL.change} />
                  <HeaderCell label="Score" sortKey="score" align="center" sort={sort} onSort={onSort} className={COL.score} />
                  <HeaderCell label={<InfoTip term="p_e">PE</InfoTip>} sortKey="pe" align="right" sort={sort} onSort={onSort} className={COL.pe} />
                  <HeaderCell label={<InfoTip term="market_cap">Mkt Cap</InfoTip>} sortKey="mcap" align="right" sort={sort} onSort={onSort} className={COL.mcap} />
                  <HeaderCell label={<InfoTip term="div_yield">Div%</InfoTip>} sortKey="div" align="right" sort={sort} onSort={onSort} className={COL.div} />
                  <HeaderCell label={<InfoTip term="rsi">RSI</InfoTip>} sortKey="rsi" align="right" sort={sort} onSort={onSort} className={COL.rsi} />
                  <HeaderCell label="Volume vs Avg" sortKey="volume_ratio" align="right" sort={sort} onSort={onSort} className={COL.volRatio} />
                  <HeaderCell label="Sector" sort={sort} onSort={onSort} className={COL.sector} />
                  <HeaderCell label="Why This Score" sort={sort} onSort={onSort} className={COL.signals} />
                </tr>
              </thead>
              <tbody>
                {filtered.length ? (
                  filtered.map((t) => (
                    <TickerRow
                      key={t.ticker}
                      t={t}
                      expanded={expanded.has(t.ticker)}
                      onToggle={() => toggleExpanded(t.ticker)}
                      detailId={`screener-detail-${t.ticker.replace(/[^A-Za-z0-9]/g, '-')}`}
                    />
                  ))
                ) : (
                  <tr>
                    {/* padding on an inner div — .mg-table td would override p-8 */}
                    <td colSpan={11}>
                      <div className="p-8 text-center text-[var(--color-text-tertiary)]">
                        No tickers match your filters.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {/* Index membership is itself dated — the lists are refreshed from an
            upstream on a monthly cron, and one of them (Russell 2000) is read
            from a tracker fund's holdings rather than the index. Saying so
            beats implying the filter knows today's membership. */}
        {universeSource?.as_of && (
          <div
            className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            {filters.universe} membership as of {universeSource.as_of}
            {universeSource.member_count ? ` — ${universeSource.member_count} companies` : ''}.
            {universeSource.source_note ? ` ${universeSource.source_note}` : ''}
          </div>
        )}
        {!isLoading && allTickers.length > 0 && data?.generated_at && (
          <div
            className="flex items-center justify-end border-t px-4 py-2.5 text-xs text-[var(--color-text-tertiary)]"
            style={{ borderColor: 'var(--color-border-subtle)' }}
          >
            <span>
              A snapshot, not live quotes. Generated{' '}
              {new Date(data.generated_at).toLocaleString('en-CA', {
                timeZone: 'America/Toronto',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              ET
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
