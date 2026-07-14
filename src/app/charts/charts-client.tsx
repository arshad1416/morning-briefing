// app/charts/charts-client.tsx — TradingView-style candlestick charts, ported
// from the legacy SPA. Candles + volume + EMA 20/50 + VWAP overlays, RSI and
// ATR indicator panes, ticker search, timeframe toggle, theme-aware colors.
//
// Data: /api/data/charts/{TICKER}.json through the Worker gate (Pro tier).
// lightweight-charts is bundled from npm — the CSP blocks CDN scripts.
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createChart,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type UTCTimestamp,
} from 'lightweight-charts';
import { GateCard } from '@/components/feature/gating/GateCard';
import { fetchGated, GateError } from '@/lib/api/gated';

/* ------------------------------------------------------------------ */
/*  Data                                                              */
/* ------------------------------------------------------------------ */

const TICKERS = [
  'AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA','SPY','QQQ','IWM',
  'DIA','AMD','AVGO','NFLX','ADBE','CRM','INTC','CSCO','PYPL','QCOM',
  'TXN','AMGN','GILD','SBUX','COST','WMT','HD','MCD','NKE','DIS',
  'JPM','BAC','GS','V','MA','UNH','JNJ','PFE','MRK','ABBV',
  'XOM','CVX','BA','CAT','GE','HON','LIN','UPS','RTX','LMT',
  'VZ','T','CMCSA','NEE','SO','DUK','PLD','AMT','CCI','EQIX',
];

type Timeframe = '1D' | '1W' | '1M' | '1Y';
const TIMEFRAMES: { tf: Timeframe; label: string }[] = [
  { tf: '1D', label: 'Daily' },
  { tf: '1W', label: 'Weekly' },
  { tf: '1M', label: 'Monthly' },
  { tf: '1Y', label: 'Yearly' },
];

interface Bar {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ChartFile {
  ticker?: string;
  generated_at?: string;
  timeframes?: Partial<Record<Timeframe, Bar[]>>;
}

const rawSchema = { parse: (d: unknown) => d as ChartFile };

/* ------------------------------------------------------------------ */
/*  Indicator math (ported verbatim from the legacy charts.js)        */
/* ------------------------------------------------------------------ */

type Point = { time: Bar['time']; value: number };

function calcEMA(data: Bar[], period: number): Point[] {
  const k = 2 / (period + 1);
  const out: Point[] = [];
  let prev = data[0].close;
  data.forEach((d, i) => {
    const val = i === 0 ? d.close : d.close * k + prev * (1 - k);
    out.push({ time: d.time, value: parseFloat(val.toFixed(2)) });
    prev = val;
  });
  return out;
}

function calcVWAP(data: Bar[]): Point[] {
  let cumV = 0;
  let cumPV = 0;
  return data.map((d) => {
    const typical = (d.high + d.low + d.close) / 3;
    cumPV += typical * d.volume;
    cumV += d.volume;
    return { time: d.time, value: parseFloat((cumPV / cumV || d.close).toFixed(2)) };
  });
}

function calcRSI(data: Bar[], period = 14): Point[] {
  if (data.length < period + 1) return [{ time: data[0].time, value: 50 }];
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < data.length; i++) {
    const diff = data[i].close - data[i - 1].close;
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }
  let avgG = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgL = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const rsi: Point[] = [
    { time: data[period].time, value: avgL === 0 ? 100 : parseFloat((100 - 100 / (1 + avgG / avgL)).toFixed(2)) },
  ];
  for (let i = period; i < gains.length; i++) {
    avgG = (avgG * (period - 1) + gains[i]) / period;
    avgL = (avgL * (period - 1) + losses[i]) / period;
    rsi.push({
      time: data[i + 1].time,
      value: avgL === 0 ? 100 : parseFloat((100 - 100 / (1 + avgG / avgL)).toFixed(2)),
    });
  }
  return rsi;
}

function calcATR(data: Bar[], period = 14): Point[] {
  if (data.length < 2) return [{ time: data[0].time, value: 0 }];
  const tr: Point[] = [{ time: data[0].time, value: data[0].high - data[0].low }];
  for (let i = 1; i < data.length; i++) {
    const hl = data[i].high - data[i].low;
    const hc = Math.abs(data[i].high - data[i - 1].close);
    const lc = Math.abs(data[i].low - data[i - 1].close);
    tr.push({ time: data[i].time, value: Math.max(hl, hc, lc) });
  }
  if (tr.length < period) return [{ time: tr[tr.length - 1].time, value: 0 }];
  const atr: Point[] = [];
  let cur = tr.slice(0, period).reduce((s, t) => s + t.value, 0) / period;
  atr.push({ time: tr[period - 1].time, value: parseFloat(cur.toFixed(2)) });
  for (let i = period; i < tr.length; i++) {
    cur = (cur * (period - 1) + tr[i].value) / period;
    atr.push({ time: tr[i].time, value: parseFloat(cur.toFixed(2)) });
  }
  return atr;
}

/* ------------------------------------------------------------------ */
/*  Theme                                                             */
/* ------------------------------------------------------------------ */

function useThemeAttr(): string {
  const [theme, setTheme] = useState('dark');
  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute('data-theme') || 'dark');
    read();
    const obs = new MutationObserver(read);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => obs.disconnect();
  }, []);
  return theme;
}

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/* ------------------------------------------------------------------ */
/*  Chart rendering                                                   */
/* ------------------------------------------------------------------ */

// lightweight-charts accepts 'YYYY-MM-DD' strings or UTC timestamps.
const asTime = (t: Bar['time']) => (typeof t === 'number' ? (t as UTCTimestamp) : (t as string));

function ChartPanes({ bars, theme }: { bars: Bar[]; theme: string }) {
  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const atrRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mainRef.current || !rsiRef.current || !atrRef.current || !bars.length) return;

    const isDark = theme === 'dark';
    const text = cssVar('--color-text-secondary') || (isDark ? '#A6A6AD' : '#57575E');
    const grid = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
    const border = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.12)';
    const up = cssVar('--color-bull') || '#2FD08C';
    const down = cssVar('--color-bear') || '#FF4D5E';
    const accent = cssVar('--color-accent') || '#FF7A1A';
    const crosshair = {
      mode: CrosshairMode.Normal,
      vertLine: { color: border, style: LineStyle.Dashed, labelBackgroundColor: isDark ? '#26262B' : '#E8E8EC' },
      horzLine: { color: border, style: LineStyle.Dashed, labelBackgroundColor: isDark ? '#26262B' : '#E8E8EC' },
    };

    const baseOptions = {
      autoSize: true,
      layout: { background: { color: 'transparent' }, textColor: text, fontSize: 11 },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      timeScale: { borderColor: border, timeVisible: false },
      rightPriceScale: { borderColor: border },
      crosshair,
    } as const;

    const charts: IChartApi[] = [];

    // ── Main: candles + volume + EMA/VWAP overlays ──
    const main = createChart(mainRef.current, { ...baseOptions, height: 420 });
    charts.push(main);
    const candles = main.addCandlestickSeries({
      upColor: up,
      downColor: down,
      borderUpColor: up,
      borderDownColor: down,
      wickUpColor: up,
      wickDownColor: down,
    });
    candles.setData(bars.map((b) => ({ time: asTime(b.time), open: b.open, high: b.high, low: b.low, close: b.close })));

    const volume = main.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
    });
    main.priceScale('vol').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      bars.map((b) => ({
        time: asTime(b.time),
        value: b.volume,
        color: b.close >= b.open ? `color-mix(in srgb, ${up} 40%, transparent)` : `color-mix(in srgb, ${down} 40%, transparent)`,
      })),
    );

    const mkLine = (color: string, width: 1 | 2, style = LineStyle.Solid) =>
      main.addLineSeries({ color, lineWidth: width, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
    const asLineData = (pts: Point[]) => pts.map((p) => ({ time: asTime(p.time), value: p.value }));

    mkLine('#6AA9FF', 1).setData(asLineData(calcEMA(bars, 20)));
    mkLine('#C08BFF', 1).setData(asLineData(calcEMA(bars, 50)));
    mkLine(accent, 1, LineStyle.Dashed).setData(asLineData(calcVWAP(bars)));

    // ── RSI pane ──
    const rsi = createChart(rsiRef.current, {
      ...baseOptions,
      height: 140,
      rightPriceScale: { borderColor: border, scaleMargins: { top: 0.1, bottom: 0.1 } },
    });
    charts.push(rsi);
    const rsiSeries = rsi.addLineSeries({ color: accent, lineWidth: 1, priceLineVisible: false, lastValueVisible: true });
    rsiSeries.setData(asLineData(calcRSI(bars, 14)));
    rsiSeries.createPriceLine({ price: 70, color: down, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });
    rsiSeries.createPriceLine({ price: 30, color: up, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });

    // ── ATR pane ──
    const atr = createChart(atrRef.current, { ...baseOptions, height: 140 });
    charts.push(atr);
    atr
      .addLineSeries({ color: '#6AA9FF', lineWidth: 1, priceLineVisible: false, lastValueVisible: true })
      .setData(asLineData(calcATR(bars, 14)));

    // Sync the three time scales
    let syncing = false;
    const unsubs = charts.map((c) =>
      c.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncing || !range) return;
        syncing = true;
        charts.forEach((other) => {
          if (other !== c) other.timeScale().setVisibleLogicalRange(range);
        });
        syncing = false;
      }),
    );
    void unsubs;

    main.timeScale().fitContent();
    rsi.timeScale().fitContent();
    atr.timeScale().fitContent();

    return () => charts.forEach((c) => c.remove());
  }, [bars, theme]);

  return (
    <div className="space-y-4">
      <Pane label="Price · EMA 20 / EMA 50 / VWAP" legend>
        <div ref={mainRef} className="h-[420px] w-full" />
      </Pane>
      <Pane label="RSI (14)">
        <div ref={rsiRef} className="h-[140px] w-full" />
      </Pane>
      <Pane label="ATR (14)">
        <div ref={atrRef} className="h-[140px] w-full" />
      </Pane>
    </div>
  );
}

function Pane({ label, legend = false, children }: { label: string; legend?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[var(--radius-tile)] border"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{label}</h3>
        {legend && (
          <div className="flex items-center gap-3 text-[10px] text-[var(--color-text-tertiary)]">
            <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3" style={{ backgroundColor: '#6AA9FF' }} /> EMA 20</span>
            <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3" style={{ backgroundColor: '#C08BFF' }} /> EMA 50</span>
            <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3" style={{ backgroundColor: 'var(--color-accent)' }} /> VWAP</span>
          </div>
        )}
      </div>
      <div className="p-2">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Ticker search combobox                                            */
/* ------------------------------------------------------------------ */

function TickerSearch({ value, onSelect }: { value: string; onSelect: (t: string) => void }) {
  const [text, setText] = useState(value);
  const [open, setOpen] = useState(false);
  const matches = useMemo(() => {
    const q = text.toUpperCase().trim();
    return q ? TICKERS.filter((t) => t.includes(q)).slice(0, 12) : TICKERS.slice(0, 12);
  }, [text]);

  return (
    <div className="relative w-40">
      <input
        type="text"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={(e) => { setOpen(true); e.target.select(); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && matches.length) {
            onSelect(matches[0]);
            setText(matches[0]);
            setOpen(false);
          }
        }}
        placeholder="Search ticker…"
        spellCheck={false}
        autoComplete="off"
        className="w-full rounded-lg border bg-[var(--color-bg-elevated)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        style={{ borderColor: 'var(--color-border-subtle)' }}
        data-numeric
      />
      {open && matches.length > 0 && (
        <ul
          className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border py-1 shadow-lg"
          style={{ backgroundColor: 'var(--color-bg-elevated)', borderColor: 'var(--color-border-default)' }}
          role="listbox"
        >
          {matches.map((t) => (
            <li key={t}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { onSelect(t); setText(t); setOpen(false); }}
                className="w-full px-3 py-1.5 text-left text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-surface)] hover:text-[var(--color-text-primary)]"
                data-numeric
                role="option"
                aria-selected={t === value}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function ChartsClient() {
  const [ticker, setTicker] = useState('SPY');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const theme = useThemeAttr();

  useEffect(() => {
    const t = localStorage.getItem('mg-charts-ticker');
    const tf = localStorage.getItem('mg-charts-timeframe') as Timeframe | null;
    if (t && TICKERS.includes(t)) setTicker(t);
    if (tf && TIMEFRAMES.some((x) => x.tf === tf)) setTimeframe(tf);
  }, []);

  const pick = (t: string) => { setTicker(t); localStorage.setItem('mg-charts-ticker', t); };
  const pickTf = (tf: Timeframe) => { setTimeframe(tf); localStorage.setItem('mg-charts-timeframe', tf); };

  const q = useQuery({
    queryKey: ['chart', ticker],
    queryFn: () => fetchGated<ChartFile>(`charts/${ticker}.json`, rawSchema),
    staleTime: 300_000,
    retry: false,
  });

  const bars = q.data?.timeframes?.[timeframe] ?? [];

  return (
    <div className="space-y-4">
      <div
        className="relative overflow-hidden rounded-[var(--radius-tile)] border p-6"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <span aria-hidden="true" className="glow-orb -top-24 -right-8" />
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-[var(--color-text-primary)]">
              Interactive <em className="italic" style={{ color: 'var(--color-accent)' }}>Charts</em>
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
              Candles, volume, EMA 20/50, VWAP — with RSI and ATR panes.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <TickerSearch value={ticker} onSelect={pick} />
            <div
              className="flex rounded-lg border p-0.5"
              style={{ borderColor: 'var(--color-border-default)' }}
              role="tablist"
              aria-label="Timeframe"
            >
              {TIMEFRAMES.map(({ tf, label }) => (
                <button
                  key={tf}
                  type="button"
                  role="tab"
                  aria-selected={timeframe === tf}
                  onClick={() => pickTf(tf)}
                  className="rounded-md px-2.5 py-1.5 text-xs font-semibold transition"
                  style={
                    timeframe === tf
                      ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }
                      : { color: 'var(--color-text-secondary)' }
                  }
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {q.isLoading ? (
        <div
          className="flex h-[420px] items-center justify-center rounded-[var(--radius-tile)] border text-sm text-[var(--color-text-tertiary)]"
          style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
        >
          Loading {ticker}…
        </div>
      ) : q.error ? (
        <GateCard
          kind={q.error instanceof GateError ? q.error.kind : 'unavailable'}
          need={q.error instanceof GateError ? (q.error.need ?? 'pro') : 'pro'}
          feature="Interactive charts"
        />
      ) : !bars.length ? (
        <div
          className="rounded-[var(--radius-tile)] border p-10 text-center"
          style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
        >
          <p className="text-sm font-medium text-[var(--color-text-primary)]">
            No {timeframe} data for {ticker}.
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">
            Try a different timeframe, or check back after the next data run.
          </p>
        </div>
      ) : (
        <ChartPanes bars={bars} theme={theme} />
      )}
    </div>
  );
}
