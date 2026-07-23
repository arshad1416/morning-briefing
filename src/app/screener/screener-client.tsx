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
import type { ScreenerTicker } from '@/lib/schemas/screener';

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
    if (!f.sector && f.universe) {
      const u = t.universe || '';
      if (f.universe === 'S&P 500' ? !u.startsWith('S&P 500') : u !== f.universe) return false;
    }
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

// Was a loose substring regex (/over|bear|.../) tested against the raw signal
// key — "over" matched inside "oversold_rsi", so RSI < 35 (+2, the single
// largest BULLISH contributor to the score) was painted red. Signal keys are
// enumerated exactly instead: only the rules that actually subtract from the
// score in compute_score() count as bearish.
const BEARISH_SIGNALS = new Set([
  'overbought_rsi',
  'extended_rsi',
  'below_ma',
  'near_low',
  'premium_pe',
  'analyst_sell',
]);

// The `signals` array is the audit trail from the score calculation: one entry
// per scoring rule that fired. The raw values are snake_case internals
// ("value_pe", "above_ma"), so spell out what each rule actually tested. Text
// only — the thresholds below are the ones the generator uses, so keep them in
// step with compute_score() in pi-scripts/generate-screener-data.py.
const SIGNAL_LABELS: Record<string, string> = {
  oversold_rsi: 'RSI under 35',
  rsi_dip: 'RSI 35–45',
  extended_rsi: 'RSI 65–75',
  overbought_rsi: 'RSI over 75',
  above_ma: 'Above 20 & 50-day avg',
  below_ma: 'Below 20 & 50-day avg',
  volume_surge: 'Volume over 1.5x avg',
  near_high: 'Within 5% of 52w high',
  near_low: 'Within 5% of 52w low',
  value_pe: 'P/E under 15',
  premium_pe: 'P/E over 30',
  analyst_buy: 'Analysts rate it buy',
  analyst_sell: 'Analysts rate it sell',
};

const signalLabel = (s: string) => SIGNAL_LABELS[s] ?? s.replace(/_/g, ' ');

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
  label: string;
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

function TickerRow({ t }: { t: ScreenerTicker }) {
  const score = t.score ?? 0;
  const vr = volRatio(t);
  const rsi = t.rsi;

  return (
    <tr
      className="border-t transition-colors hover:bg-[var(--color-bg-elevated)]"
      style={{ borderColor: 'var(--color-border-subtle)' }}
    >
      <td className={COL.ticker}>
        <Link
          href={`/ticker/${encodeURIComponent(t.ticker)}/`}
          className="font-semibold text-[var(--color-accent)] hover:underline"
          data-numeric
        >
          {t.ticker}
        </Link>
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
            const bearish = BEARISH_SIGNALS.has(s);
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
  );
}

/* ------------------------------------------------------------------ */
/*  Treemap                                                           */
/* ------------------------------------------------------------------ */

function Treemap({ tickers }: { tickers: ScreenerTicker[] }) {
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
              href={`/ticker/${encodeURIComponent(t.ticker)}/`}
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

export function ScreenerClient() {
  const { data: result, isLoading } = useQuery(screenerQuery());
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<Sort>({ key: 'score', dir: 'desc' });
  const [view, setView] = useState<'table' | 'treemap'>('table');
  const [presets, setPresets] = useState<StoredPreset[]>([]);
  const [presetName, setPresetName] = useState('');

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
          Filter and sort the five lists we scan: the S&amp;P 500, the TSX 60, and our tech-and-growth,
          high-dividend and fixed-income-and-commodities watchlists.{isLite ? ' The public preview below shows the eight highest-scoring of them. ' : ' '}
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
          taken.
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
          label="Avg Score"
          value={ms?.avg_score != null ? ms.avg_score.toFixed(1) : '—'}
          caption="All scanned tickers — not just what's shown below"
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
          <Field label="Search">
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
              <option value="S&P 500">S&amp;P 500</option>
              <option value="TSX 60">TSX 60</option>
              <option value="Tech & Growth">Tech &amp; Growth</option>
              <option value="High Dividend">High Dividend</option>
              <option value="Fixed Income & Commodities">Fixed Income &amp; Commodities</option>
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
                  filtered.map((t) => <TickerRow key={t.ticker} t={t} />)
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
