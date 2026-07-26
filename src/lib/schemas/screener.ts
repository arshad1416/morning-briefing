// lib/schemas/screener.ts — zod schemas for the stock screener.
//
// The Pi generator can emit non-numeric values (e.g. pe:"Infinity" from
// yfinance) — one bad field must not kill the whole table, so every numeric
// field coerces and falls back to null instead of failing the parse.
import { z } from 'zod';

const num = z.preprocess((v) => {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}, z.number().nullable());

export const ScreenerTickerSchema = z.object({
  ticker: z.string(),
  name: z.string().nullish(),
  // `universe` is the legacy single-valued field. It cannot express real index
  // membership — a ticker is routinely in several at once (88 of the 103
  // Nasdaq-100 names are also S&P 500 constituents), and the generator's
  // first-wins map therefore made most of the Nasdaq-100 unreachable through a
  // Nasdaq-100 filter. `universes` is the multi-membership array that replaces
  // it; both are read, with the array preferred. See the membership block in
  // pi-scripts/generate-screener-data.py.
  universe: z.string().nullish(),
  universes: z.array(z.string()).nullish(),
  sector: z.string().nullish(),
  industry: z.string().nullish(),
  price: num,
  change_pct: num,
  score: num,
  pe: num,
  forwardPe: num.optional(),
  marketCap: num,
  divYield: num,
  rsi: num,
  volume: num,
  avgVolume: num.optional(),
  volume_ratio: num.optional(),
  vol_ratio: num.optional(),
  // Read by the expanded per-ticker detail panel. All optional: the fields are
  // written by the current generator but older archived snapshots predate some
  // of them, and one absent field must never fail the whole table's parse.
  sma20: num.optional(),
  sma50: num.optional(),
  high52w: num.optional(),
  low52w: num.optional(),
  targetPrice: num.optional(),
  beta: num.optional(),
  institutionPct: num.optional(),
  // The producer emits signals[] tags + an analyst recommendation; the old
  // singular signal/direction fields were never written by any generator.
  recommendation: z.string().nullish(),
  signals: z.array(z.string()).nullish(),
  above_52w_high_pct: num.optional(),
  below_52w_low_pct: num.optional(),
  above_sma20: z.boolean().nullish(),
  above_sma50: z.boolean().nullish(),
});

export const UniverseSourceSchema = z.object({
  source_url: z.string().nullish(),
  source_note: z.string().nullish(),
  as_of: z.string().nullish(),
  fetched_at: z.string().nullish(),
  member_count: z.number().nullish(),
});

export const ScreenerDataSchema = z.object({
  generated_at: z.string().nullish(),
  ticker_count: z.number().nullish(),
  // Which universes the run actually covered. Without this the UI cannot tell
  // "no rows match your filters" apart from "this scan never looked at that
  // index" — and offering an unscanned index in the filter would read to the
  // visitor as "nothing there qualifies". Absent on snapshots generated before
  // multi-index support, where the UI falls back to deriving it from the rows.
  universes_scanned: z.array(z.string()).nullish(),
  // Where each index's membership came from and how current it is, so the page
  // can date the list instead of implying it is live.
  universe_sources: z.record(z.string(), UniverseSourceSchema).nullish(),
  market_summary: z
    .object({
      avg_score: num.optional(),
      green_count: z.number().nullish(),
      red_count: z.number().nullish(),
    })
    .nullish(),
  tickers: z.array(ScreenerTickerSchema),
});

export type ScreenerTicker = z.infer<typeof ScreenerTickerSchema>;
export type ScreenerData = z.infer<typeof ScreenerDataSchema>;
export type UniverseSource = z.infer<typeof UniverseSourceSchema>;

/**
 * The index universes the site offers in its filter, in the order shown.
 *
 * These are index labels, not a promise that the latest scan covered them —
 * membership lists live in pi-scripts/universe_constituents.json and the scan
 * set is chosen per run with `--universes`. `universesInData()` below is what
 * decides whether a given option has rows behind it.
 */
export const INDEX_UNIVERSES = [
  'S&P 500',
  'S&P 400',
  'S&P 600',
  'Nasdaq-100',
  'Russell 2000',
] as const;

/** The curated watchlists this scan has always carried, beyond the indices. */
export const WATCHLIST_UNIVERSES = [
  'TSX 60',
  'Tech & Growth',
  'High Dividend',
  'Fixed Income & Commodities',
] as const;

/** Every universe a row claims membership of, array first, string as fallback. */
export function tickerUniverses(ticker: ScreenerTicker): string[] {
  // `ticker.universes` PRESENT wins, even when empty — an empty array is the
  // generator saying "this company is in none of them", which is a real answer.
  // Testing `.length` instead made [] falsy and fell through to the legacy
  // string, which is exactly the stale label the array exists to overrule: the
  // 21 hand-typed names the S&P 500 dropped would have gone on claiming "S&P
  // 500" through the fallback, defeating the generator-side guard and the test
  // that asserts it.
  if (ticker.universes) return ticker.universes;
  const single = ticker.universe;
  if (!single) return [];
  // Pre-multi-index snapshots split the S&P 500 sample across "S&P 500",
  // "S&P 500 (continued)" and "S&P 500 (continued 2)". Collapsing here is what
  // the screener's startsWith() special case used to do inline.
  return [single.startsWith('S&P 500') ? 'S&P 500' : single];
}

/** True when the row belongs to `universe`. */
export const tickerInUniverse = (ticker: ScreenerTicker, universe: string) =>
  tickerUniverses(ticker).includes(universe);

/**
 * Universes this snapshot can actually answer for — or `null` when it cannot
 * be known.
 *
 * Three cases, and the third is why this returns null rather than an empty set:
 *  1. `universes_scanned` present — authoritative. It is the only field that
 *     separates "scanned it, nothing matched" from "never scanned it".
 *  2. Absent, but the rows ARE the whole dataset — derive from the rows.
 *  3. Absent and the rows are a sample (the public teaser is 8 rows out of
 *     hundreds) — unknowable. Deriving here would mark seven of the nine
 *     universes "not in this scan" on the strength of eight rows that were
 *     picked by score, which is a claim the data cannot support in either
 *     direction. Callers show no coverage markers at all in this case.
 */
export function universesInData(data: ScreenerData | null | undefined): Set<string> | null {
  if (!data) return null;
  if (data.universes_scanned?.length) return new Set(data.universes_scanned);
  const total = data.ticker_count ?? data.tickers.length;
  if (data.tickers.length < total) return null;
  return new Set(data.tickers.flatMap(tickerUniverses));
}

/** Discriminated result: the full subscriber dataset, or the public teaser. */
export type ScreenerResult =
  | { mode: 'full'; data: ScreenerData }
  | { mode: 'lite'; gate: 'signin' | 'upgrade' | 'unavailable'; need?: 'basic' | 'pro'; data: ScreenerData | null };
