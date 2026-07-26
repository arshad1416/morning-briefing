// lib/backtests/strategies.ts — what each backtested rule does, in words.
//
// IMPORTANT, and stated on the page too: the code that actually ran these
// backtests is NOT in this repository — it lives in arshad1416/hermes-scripts
// and only its output is committed here (see README). So the entry and exit
// wording below describes the standard form of each named rule family, filled
// in with the exact parameter values the run recorded. It has not been read
// back off the executing source.
//
// What IS verifiable from the committed files, and shown beside this on the
// page, is every closed trade: its entry date, exit date, both prices and its
// result. That is the ground truth of what the rule did.

export type StrategySpec = {
  /** Human name. */
  title: string;
  /** One line on the idea behind it. */
  idea: string;
  /** Entry condition, with {param} placeholders filled from the run. */
  entry: (params: Record<string, number | string>) => string;
  /** Exit condition. */
  exit: (params: Record<string, number | string>) => string;
  /** How the parameters are named in the file, in reading order. */
  paramLabels: Record<string, string>;
};

const n = (params: Record<string, number | string>, key: string, fallback = '?') =>
  params[key] != null ? String(params[key]) : fallback;

export const STRATEGY_SPECS: Record<string, StrategySpec> = {
  sma_cross: {
    title: 'Moving-average crossover',
    idea:
      'Follows the trend. It treats a short-term average price crossing above a longer-term one as the start of an up-move, and the reverse crossing as the end of it.',
    entry: (p) =>
      `The average closing price over the last ${n(p, 'sma_fast')} trading days crosses above the average over the last ${n(p, 'sma_slow')} days.`,
    exit: (p) =>
      `The ${n(p, 'sma_fast')}-day average crosses back below the ${n(p, 'sma_slow')}-day average.`,
    paramLabels: { sma_fast: 'Short average (days)', sma_slow: 'Long average (days)' },
  },
  mean_reversion: {
    title: 'Mean reversion (RSI)',
    idea:
      'Bets against the recent move. It buys after a sharp fall on the expectation that the price snaps back toward its recent range.',
    entry: (p) =>
      `The ${n(p, 'rsi_period')}-day RSI falls below ${n(p, 'rsi_oversold')} — a reading conventionally called oversold.`,
    exit: (p) => `The ${n(p, 'rsi_period')}-day RSI rises above ${n(p, 'rsi_overbought')}.`,
    paramLabels: {
      rsi_period: 'RSI lookback (days)',
      rsi_oversold: 'Buy below RSI',
      rsi_overbought: 'Sell above RSI',
    },
  },
  breakout: {
    title: 'Breakout',
    idea:
      'Follows strength. It buys when the price pushes past its recent ceiling, on the expectation that the move keeps going, and gives up when it drops through its recent floor.',
    entry: (p) => `The price makes a new high for the last ${n(p, 'period_high')} trading days.`,
    exit: (p) => `The price makes a new low for the last ${n(p, 'period_low')} trading days.`,
    paramLabels: { period_high: 'High lookback (days)', period_low: 'Low lookback (days)' },
  },
  vwap_reversion: {
    title: 'VWAP reversion',
    idea:
      'Another bet against the recent move, but measured against the average price weighted by how much traded at each level rather than by an RSI reading.',
    entry: (p) =>
      `The price falls below its volume-weighted average price over the last ${n(p, 'vwap_period')} trading days.`,
    exit: (p) => `The price returns above that ${n(p, 'vwap_period')}-day volume-weighted average.`,
    paramLabels: { vwap_period: 'VWAP lookback (days)' },
  },
};

export const strategyTitle = (key: string) =>
  STRATEGY_SPECS[key]?.title ?? key.replace(/_/g, ' ');

export const paramLabel = (strategy: string, key: string) =>
  STRATEGY_SPECS[strategy]?.paramLabels[key] ?? key.replace(/_/g, ' ');
