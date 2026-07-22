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

// ── GEX ─────────────────────────────────────────────────────────────────────
// Source of truth is data/maplegamma-data.json (push_gex.py, refreshed every
// 30 min in market hours). The schema below parses that file and TRANSFORMS
// it into the GexData/GexMode shape the components consume. The previous
// schema modeled gex_data.json — a dead artifact last written 2026-06-11,
// which fed the redesigned Options page month-old gamma levels.

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

const MgGammaRowSchema = z
  .object({
    strike: z.number(),
    call_gex: z.number().default(0),
    put_gex: z.number().default(0),
    net_gex: z.number().default(0),
    dex: z.number().default(0),
    vex: z.number().default(0),
    oi: z.number().default(0),
  })
  .passthrough();

const MgBucketSchema = z
  .object({
    expiry_count: z.number().default(0),
    gamma_profile: z.array(MgGammaRowSchema).default([]),
    total_gex: z.number().default(0),
    total_dex: z.number().default(0),
    total_vex: z.number().default(0),
  })
  .passthrough();

const MapleGammaFileSchema = z
  .object({
    generated_at: z.string(),
    tickers: z.object({
      SPX: z
        .object({
          current_price: z.number().default(0),
          gamma_regime: z.string().default('neutral'),
          max_gex_strike: z.number().nullish(),
          max_gex_value: z.number().nullish(),
          total_gex: z.number().default(0),
          total_dex: z.number().default(0),
          total_vex: z.number().default(0),
          // Reconstructed greeks (push_gex.py, from IBKR/yfinance chains)
          total_vanna: z.number().nullish(),
          total_charm: z.number().nullish(),
          total_dealer_gex: z.number().nullish(),
          gamma_flip: z.number().nullish(),
          max_pain: z.number().nullish(),
          gamma_profile: z.array(MgGammaRowSchema).default([]),
          expiry_data: z
            .object({
              all: MgBucketSchema.optional(),
              weekly: MgBucketSchema.optional(),
              monthly: MgBucketSchema.optional(),
            })
            .passthrough()
            .optional(),
        })
        .passthrough(),
    }),
  })
  .passthrough();

type MgBucket = z.infer<typeof MgBucketSchema>;
type MgTicker = z.infer<typeof MapleGammaFileSchema>['tickers']['SPX'];

function regimeOf(totalGex: number): 'bullish' | 'bearish' | 'neutral' {
  return totalGex > 0 ? 'bullish' : totalGex < 0 ? 'bearish' : 'neutral';
}

function toMode(bucket: MgBucket, spx: MgTicker): z.infer<typeof GexModeSchema> {
  const rows = bucket.gamma_profile;
  const top = rows.reduce(
    (best, r) => (Math.abs(r.net_gex) > Math.abs(best?.net_gex ?? 0) ? r : best),
    rows[0],
  );
  return {
    total_gex: bucket.total_gex,
    total_dex: bucket.total_dex,
    total_vex: bucket.total_vex,
    price: spx.current_price,
    max_gex_strike: top?.strike ?? spx.max_gex_strike ?? 0,
    max_gex_value: top?.net_gex ?? spx.max_gex_value ?? 0,
    expiry: '',
    expiry_count: bucket.expiry_count,
    gamma_regime: regimeOf(bucket.total_gex),
    // Rows arrive call/put-merged per strike; split back into C and P rows
    // because the flow table and GammaWallChart branch on type === 'C'.
    // (A previous 'NET' emission put every strike in the put bucket.)
    strikes: rows.flatMap((r) => {
      const out: Array<z.infer<typeof GexStrikeSchema>> = [];
      // oi/dex/vex are strike-level (the producer doesn't split them by side),
      // so both rows carry them. Zeroing the put side at dual-sided strikes
      // made the biggest put walls tooltip as "OI 0". Consumers only display
      // these per-row — nothing sums them — so duplication is safe.
      if (r.call_gex !== 0) {
        out.push({ strike: r.strike, type: 'C', oi: r.oi, gamma: 0, gex: r.call_gex, delta: 0, dex: r.dex, vega: 0, vex: r.vex });
      }
      if (r.put_gex !== 0) {
        out.push({ strike: r.strike, type: 'P', oi: r.oi, gamma: 0, gex: r.put_gex, delta: 0, dex: r.dex, vega: 0, vex: r.vex });
      }
      return out;
    }),
  };
}

export const GexDataSchema = MapleGammaFileSchema.transform((f) => {
  const spx = f.tickers.SPX;
  const ed = spx.expiry_data ?? {};
  const allBucket: MgBucket =
    ed.all ??
    ({
      expiry_count: 0,
      gamma_profile: spx.gamma_profile,
      total_gex: spx.total_gex,
      total_dex: spx.total_dex,
      total_vex: spx.total_vex,
    } as MgBucket);
  return {
    generated_at: f.generated_at,
    ticker: 'SPY',
    price_source: 'yfinance',
    modes: {
      all: toMode(allBucket, spx),
      weeklies: ed.weekly ? toMode(ed.weekly, spx) : undefined,
      monthly: ed.monthly ? toMode(ed.monthly, spx) : undefined,
    },
    // Ticker-level dealer positioning (reconstructed greeks). dealer_gamma
    // signs puts negative (true dealer convention) — total_gex above is the
    // legacy gross number. flip = zero-gamma spot; regime derived from signed.
    positioning: {
      spot: spx.current_price,
      dealer_gamma: spx.total_dealer_gex ?? null,
      gamma_flip: spx.gamma_flip ?? null,
      max_pain: spx.max_pain ?? null,
      vanna: spx.total_vanna ?? null,
      charm: spx.total_charm ?? null,
      signed_regime:
        spx.total_dealer_gex == null
          ? 'neutral'
          : spx.total_dealer_gex > 0
          ? 'long'
          : spx.total_dealer_gex < 0
          ? 'short'
          : 'neutral',
    },
  };
});

// ── NOPE ────────────────────────────────────────────────────────────────────
// Pro-gated end-of-day calculation produced by pi-scripts/nope_calculator.py.
// The artifact intentionally excludes raw deltas and calibration coefficients.
const NopeSymbolSchema = z.object({
  spot_price: z.number().nullable(),
  stock_volume: z.number().int().nullable(),
  call_volume: z.number().int().nullable(),
  put_volume: z.number().int().nullable(),
  nope: z.number().nullable(),
  nope_fill: z.number().nullable(),
});

export const NopeDetailSchema = z.object({
  generated_at: z.string(),
  methodology: z.string(),
  symbols: z.record(NopeSymbolSchema),
});

// ── Accuracy ─────────────────────────────────────────────────────────────────
// Parses the REAL accuracy.json emitted by generate_prediction_accuracy.py
// (nested summary/expectancy/drawdown blocks, percent units) and transforms it
// to the flat fraction-based shape the components consume. The previous flat
// schema matched a mock that never existed — every parse threw, so the Models
// tiles rendered "unavailable" from day one of the redesign.

const RealAccuracyFileSchema = z
  .object({
    generated_at: z.string().optional(),
    summary: z
      .object({
        total_trades: z.number().default(0),
        win_rate: z.number().default(0),
      })
      .passthrough(),
    expectancy: z
      .object({
        expectancy_pct: z.number().default(0),
        profit_factor: z.number().nullable().default(null),
        kelly_fraction: z.number().default(0),
        win_rate: z.number().default(0),
        n_trades: z.number().default(0),
        n_wins: z.number().default(0),
        n_losses: z.number().default(0),
      })
      .passthrough(),
    drawdown: z
      .object({
        max_drawdown_pct: z.number().default(0),
      })
      .passthrough(),
  })
  .passthrough();

export const AccuracySchema = RealAccuracyFileSchema.transform((f) => ({
  total_signals: f.expectancy.n_trades || f.summary.total_trades,
  hit_rate: (f.expectancy.win_rate || f.summary.win_rate) / 100,
  /** Percent per trade (expectancy_pct) — render with a % suffix, not $. */
  expectancy: f.expectancy.expectancy_pct,
  profit_factor: f.expectancy.profit_factor,
  max_drawdown: f.drawdown.max_drawdown_pct / 100,
  kelly_fraction: f.expectancy.kelly_fraction / 100,
  win_count: f.expectancy.n_wins,
  loss_count: f.expectancy.n_losses,
}));

// ── Prediction engine (backtest corpus + live trading summary) ───────────────
// prediction-engine.json (Pro-gated) carries the REAL backtest summary — the
// 17k-trade V-series corpus — which is what a tile named "Backtest Summary"
// should show (accuracy.json is live-sim accuracy, a different thing).

export const PredictionEngineSchema = z
  .object({
    generated_at: z.string(),
    summary: z
      .object({
        total_backtest_trades: z.number().default(0),
        tickers_tested: z.number().default(0),
        date_range: z.string().default(''),
        best_win_rate: z.string().default(''),
        best_avg_pnl: z.string().default(''),
        best_profit_factor: z.string().default(''),
      })
      .passthrough(),
    live_trading: z
      .object({
        summary: z
          .object({
            win_rate: z.number().default(0),
            closed_trades: z.number().default(0),
            return_pct: z.number().default(0),
            open_positions: z.number().default(0),
          })
          .passthrough(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// simulation.json — daily live-sim summary (generate_prediction_engine.py).
export const SimulationSchema = z
  .object({
    generated_at: z.string().optional(),
    summary: z
      .object({
        total_return: z.number().nullable().default(null),
        sharpe: z.number().nullable().default(null),
        max_drawdown: z.number().nullable().default(null),
        win_rate: z.number().nullable().default(null),
        total_trades: z.number().nullable().default(null),
        avg_trade: z.number().nullable().default(null),
      })
      .passthrough(),
    strategies: z
      .array(
        z
          .object({
            name: z.string(),
            return: z.number().nullable().default(null),
            trades: z.number().nullable().default(null),
            win_rate: z.number().nullable().default(null),
          })
          .passthrough(),
      )
      .default([]),
  })
  .passthrough();
export type Simulation = z.infer<typeof SimulationSchema>;

export const BacktestSchema = z.object({
  total_trades: z.number(),
  tickers_count: z.number(),
  years: z.number(),
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
export type NopeDetail = z.infer<typeof NopeDetailSchema>;
export type Accuracy = z.infer<typeof AccuracySchema>;
export type PredictionEngine = z.infer<typeof PredictionEngineSchema>;
export type Backtest = z.infer<typeof BacktestSchema>;
