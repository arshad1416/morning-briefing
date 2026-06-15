// lib/schemas/market.ts — zod schemas for market data
import { z } from 'zod';

export const IndexSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  change_pct: z.number(),
});

export const MarketSummarySchema = z.object({
  vix: z.number(),
  ten_year_yield: z.number(),
  indices: z.array(IndexSchema),
  fx_rates: z.array(z.object({ pair: z.string(), price: z.number() })),
});

export const VerdictSchema = z.object({
  generated_at: z.string(),
  signal: z.enum(['bullish', 'bearish', 'neutral']),
  conviction: z.number(),
  conviction_source: z.string(),
  narrative: z.string(),
  narrative_source: z.string(),
  confidence_interval: z.tuple([z.number(), z.number()]),
  model_features: z.object({
    vix: z.number(),
    vix_score: z.number(),
    sleeve_a_signals: z.number(),
    avg_signal_score: z.number(),
    max_signal_score: z.number(),
    recent_hit_rate: z.number(),
    recent_trades: z.number(),
    breadth: z.number(),
    vix_contango: z.number(),
    calibration_source: z.string(),
    confidence_interval: z.tuple([z.number(), z.number()]),
  }),
});

export const NewsHeadlineSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string(),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  summary: z.string(),
});

export const PremarketSetupSchema = z.object({
  ticker: z.string(),
  price: z.number(),
  change_pct: z.number(),
  score: z.number(),
  signals: z.array(z.string()),
  rsi: z.number(),
  above_sma_20: z.boolean(),
  above_sma_50: z.boolean(),
});

export const LatestDataSchema = z.object({
  generated_at: z.string(),
  market_summary: MarketSummarySchema,
  narrative: z.object({
    summary_paragraph: z.string(),
  }),
  central_banks: z.record(z.string()),
  market_news: z.object({
    headlines: z.array(NewsHeadlineSchema),
    earnings: z.array(z.any()),
    analyst_ratings: z.array(z.any()),
  }),
  geopolitical: z.array(z.object({
    title: z.string(),
    source: z.string(),
    url: z.string(),
    date: z.string(),
    summary: z.string(),
  })),
  premarket_top_setups: z.array(PremarketSetupSchema),
  congress: z.object({
    recent_trades: z.array(z.any()),
    summary: z.string(),
  }),
});

export const GexStrikeSchema = z.object({
  strike: z.number(),
  type: z.string(),
  oi: z.number(),
  gamma: z.number(),
  gex: z.number(),
  delta: z.number(),
  dex: z.number(),
  vega: z.number(),
  vex: z.number(),
});

export const GexModeSchema = z.object({
  total_gex: z.number(),
  total_dex: z.number(),
  total_vex: z.number(),
  price: z.number(),
  max_gex_strike: z.number(),
  max_gex_value: z.number(),
  expiry: z.string(),
  expiry_count: z.number(),
  gamma_regime: z.enum(['bullish', 'bearish', 'neutral']),
  strikes: z.array(GexStrikeSchema),
});

export const GexDataSchema = z.object({
  generated_at: z.string(),
  ticker: z.string(),
  price_source: z.string(),
  modes: z.object({
    all: GexModeSchema,
    weeklies: GexModeSchema.optional(),
    monthly: GexModeSchema.optional(),
  }),
});

export const AccuracySchema = z.object({
  total_signals: z.number(),
  hit_rate: z.number(),
  expectancy: z.number(),
  profit_factor: z.number(),
  max_drawdown: z.number(),
  kelly_fraction: z.number(),
  win_count: z.number(),
  loss_count: z.number(),
});

export const BacktestSchema = z.object({
  total_trades: z.number(),
  tickers_count: z.number(),
  years: z.number(),
  accuracy: AccuracySchema.optional(),
});

// Inferred types
export type Index = z.infer<typeof IndexSchema>;
export type MarketSummary = z.infer<typeof MarketSummarySchema>;
export type Verdict = z.infer<typeof VerdictSchema>;
export type NewsHeadline = z.infer<typeof NewsHeadlineSchema>;
export type PremarketSetup = z.infer<typeof PremarketSetupSchema>;
export type LatestData = z.infer<typeof LatestDataSchema>;
export type GexStrike = z.infer<typeof GexStrikeSchema>;
export type GexMode = z.infer<typeof GexModeSchema>;
export type GexData = z.infer<typeof GexDataSchema>;
export type Accuracy = z.infer<typeof AccuracySchema>;
export type Backtest = z.infer<typeof BacktestSchema>;
