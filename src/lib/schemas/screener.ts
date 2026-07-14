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
  universe: z.string().nullish(),
  sector: z.string().nullish(),
  industry: z.string().nullish(),
  price: num,
  change_pct: num,
  score: num,
  pe: num,
  marketCap: num,
  divYield: num,
  rsi: num,
  volume: num,
  volume_ratio: num.optional(),
  vol_ratio: num.optional(),
  signal: z.string().nullish(),
  direction: z.string().nullish(),
  signals: z.array(z.string()).nullish(),
  above_52w_high_pct: num.optional(),
  below_52w_low_pct: num.optional(),
  above_sma20: z.boolean().nullish(),
  above_sma50: z.boolean().nullish(),
});

export const ScreenerDataSchema = z.object({
  generated_at: z.string().nullish(),
  ticker_count: z.number().nullish(),
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

/** Discriminated result: the full subscriber dataset, or the public teaser. */
export type ScreenerResult =
  | { mode: 'full'; data: ScreenerData }
  | { mode: 'lite'; gate: 'signin' | 'upgrade' | 'unavailable'; need?: 'basic' | 'pro'; data: ScreenerData | null };
