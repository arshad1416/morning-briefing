// lib/screener/score.ts — one source of truth for reading the screener score.
//
// The score itself is computed on the Pi by compute_score() in
// pi-scripts/generate-screener-data.py. NOTHING HERE RECOMPUTES IT. Every
// point value below is read back out of the `signals[]` array that
// compute_score() emits as its own audit trail — one entry per rule that
// fired. That array is the contract; this file only translates it.
//
// Why not re-derive the score from the raw fields? Because a second
// implementation is a second source of truth, and the moment the Python moves
// a threshold the site would confidently display a different number than the
// one it is showing beside it. The raw fields are read here ONLY to say what
// the check measured — never to add up points.
//
// Keep the labels and thresholds in step with compute_score().

import type { ScreenerTicker } from '@/lib/schemas/screener';

/** compute_score() starts every ticker at a neutral 5. */
export const SCORE_BASE = 5;
/** ...then clamps: `score = max(1, min(10, score))`. */
export const SCORE_MIN = 1;
export const SCORE_MAX = 10;

export type ScoreCheckKey = 'rsi' | 'ma' | 'volume' | 'range52w' | 'pe' | 'analyst';

type Rule = {
  /** The tag compute_score() appends to signals[]. */
  signal: string;
  /** The delta compute_score() applies when this rule fires. */
  points: number;
  /** Plain-English name of the condition. */
  label: string;
};

type CheckSpec = {
  key: ScoreCheckKey;
  /** Heading for this check in the breakdown. */
  title: string;
  /** What the check looks at, in plain English. */
  question: string;
  /** Every rule in this check, in the order compute_score() tests them. */
  rules: Rule[];
  /** The reading the rules are tested against, as text. `null` = not measured. */
  measure: (t: ScreenerTicker) => string | null;
  /** What it means that no rule fired — given the measured value. */
  neutral: string;
};

const volumeRatio = (t: ScreenerTicker) => t.volume_ratio ?? t.vol_ratio ?? null;

/* The six checks, in compute_score()'s own order. `points` mirrors the Python
   exactly — if a delta changes there, it changes here. */
export const SCORE_CHECKS: CheckSpec[] = [
  {
    key: 'rsi',
    title: 'Momentum (RSI)',
    question:
      'Has the price run up or fallen hard lately? The screener treats a beaten-down reading as the opportunity and a stretched one as the risk — so this check adds points for LOW readings.',
    rules: [
      { signal: 'oversold_rsi', points: 2, label: 'RSI under 35' },
      { signal: 'rsi_dip', points: 1, label: 'RSI 35–45' },
      { signal: 'extended_rsi', points: -1, label: 'RSI 65–75' },
      { signal: 'overbought_rsi', points: -2, label: 'RSI over 75' },
    ],
    measure: (t) => (t.rsi == null ? null : `RSI ${t.rsi.toFixed(1)}`),
    neutral: 'sits in the 45–65 middle band, which neither adds nor subtracts.',
  },
  {
    key: 'ma',
    title: 'Price vs average price',
    question:
      'Is the price above or below its own average over the last 20 and 50 trading days? Above both counts as an uptrend, below both as a downtrend. One of each counts as neither.',
    rules: [
      { signal: 'above_ma', points: 1, label: 'Above both the 20- and 50-day average' },
      { signal: 'below_ma', points: -1, label: 'Below both the 20- and 50-day average' },
    ],
    measure: (t) => {
      if (t.above_sma20 == null || t.above_sma50 == null) return null;
      const above = (flag: boolean) => (flag ? 'above' : 'below');
      return `${above(!!t.above_sma20)} the 20-day, ${above(!!t.above_sma50)} the 50-day`;
    },
    neutral: 'is above one average and below the other, so the check stays neutral.',
  },
  {
    key: 'volume',
    title: 'Trading activity',
    question:
      'Did far more shares change hands than usual? A burst of volume says the move has participation behind it. There is no penalty for quiet trading — this check can only add.',
    rules: [{ signal: 'volume_surge', points: 1, label: 'Traded over 1.5× its 50-day average volume' }],
    measure: (t) => {
      const ratio = volumeRatio(t);
      return ratio == null ? null : `${ratio.toFixed(2)}× its 50-day average volume`;
    },
    neutral: 'is at or below 1.5× average, so no volume point is awarded.',
  },
  {
    key: 'range52w',
    title: 'Position in the 52-week range',
    question:
      'Is the price near the highest or lowest it has been in the past year? Near the high counts as strength, near the low as weakness. Only one of the two can fire.',
    rules: [
      { signal: 'near_high', points: 1, label: 'Within 5% of the 52-week high' },
      { signal: 'near_low', points: -1, label: 'Within 5% of the 52-week low' },
    ],
    // NOTE the field-name trap documented in generate-screener-data.py:
    // `above_52w_high_pct` is the percent the price sits BELOW the 52-week
    // high, and `below_52w_low_pct` is the percent it sits ABOVE the low. The
    // names read backwards; the values do not. Getting this the wrong way
    // round here would print the exact opposite of what the check tested.
    measure: (t) => {
      const belowHigh = t.above_52w_high_pct;
      const aboveLow = t.below_52w_low_pct;
      const parts: string[] = [];
      if (belowHigh != null) parts.push(`${belowHigh.toFixed(1)}% below its 52-week high`);
      if (aboveLow != null) parts.push(`${aboveLow.toFixed(1)}% above its 52-week low`);
      return parts.length ? parts.join(', ') : null;
    },
    neutral: 'is more than 5% away from both ends of its range, so neither rule applies.',
  },
  {
    key: 'pe',
    title: 'Valuation (P/E)',
    question:
      'How much are investors paying for each dollar the company earns? A low multiple counts as cheap, a high one as expensive. Companies with no earnings have no P/E and are skipped.',
    rules: [
      { signal: 'value_pe', points: 1, label: 'P/E under 15 (and above zero)' },
      { signal: 'premium_pe', points: -1, label: 'P/E over 30' },
    ],
    measure: (t) => (t.pe == null ? null : `P/E ${t.pe.toFixed(1)}`),
    neutral: 'falls between 15 and 30, which the screener treats as ordinary.',
  },
  {
    key: 'analyst',
    title: 'Analyst rating',
    question:
      'What is the consensus call from the analysts who cover the stock? Only outright buy or sell ratings count — a hold does nothing.',
    rules: [
      { signal: 'analyst_buy', points: 1, label: 'Consensus rating is buy or strong buy' },
      { signal: 'analyst_sell', points: -1, label: 'Consensus rating is sell or strong sell' },
    ],
    measure: (t) =>
      t.recommendation ? `rated “${String(t.recommendation).replace(/_/g, ' ')}”` : null,
    neutral: 'is a hold, or the stock has no analyst coverage, so no point either way.',
  },
];

/** signal tag → its rule and the check it belongs to. */
const RULE_INDEX = new Map<string, { rule: Rule; check: CheckSpec }>(
  SCORE_CHECKS.flatMap((check) => check.rules.map((rule) => [rule.signal, { rule, check }] as const)),
);

/** Plain-English label for a raw signal tag. Used by the table chips too. */
export const SIGNAL_LABELS: Record<string, string> = Object.fromEntries(
  SCORE_CHECKS.flatMap((check) => check.rules.map((rule) => [rule.signal, rule.label])),
);

export const signalLabel = (signal: string) =>
  SIGNAL_LABELS[signal] ?? signal.replace(/_/g, ' ');

export const signalPoints = (signal: string): number | null =>
  RULE_INDEX.get(signal)?.rule.points ?? null;

/**
 * Bearish = the rule SUBTRACTS from the score. Derived from the point values
 * rather than pattern-matched on the tag name, which is how an earlier version
 * managed to paint `oversold_rsi` — the single largest bullish contributor —
 * red, because the substring "over" also appears in "overbought".
 */
export const isBearishSignal = (signal: string) => (signalPoints(signal) ?? 0) < 0;

export type ScoreCheckResult = {
  key: ScoreCheckKey;
  title: string;
  question: string;
  /** The rules this check can apply, with their weights — fired or not. */
  rules: Rule[];
  /** The rule that fired, or null. */
  fired: Rule | null;
  /** The delta this check contributed. 0 when nothing fired. */
  points: number;
  /** What the check measured for this ticker, or null when the data is absent. */
  measured: string | null;
  /** One sentence explaining this check's outcome for this ticker. */
  reason: string;
};

export type ScoreBreakdown = {
  base: number;
  checks: ScoreCheckResult[];
  /** base + every delta, BEFORE the 1–10 clamp. */
  subtotal: number;
  /** The score the Pi published — always what the UI displays. */
  published: number | null;
  /** True when the clamp moved the subtotal (e.g. 11 → 10). */
  clamped: boolean;
  /**
   * False when the published score does not equal the clamped subtotal. That
   * means the emitted signals[] no longer explain the score — a generator
   * change the site has not caught up with. Shown to the reader rather than
   * hidden, because a breakdown that silently disagrees with the number above
   * it is worse than no breakdown.
   */
  reconciles: boolean;
  /** Signal tags with no rule here — a newer generator emitting a new rule. */
  unknownSignals: string[];
};

/**
 * Read the published score back into its component checks.
 *
 * Returns null when the row carries no `signals` array at all: the schema
 * allows it (`.nullish()`), and inventing a breakdown from the raw fields
 * would be recomputing the score, which is exactly what this module refuses
 * to do. Callers show a "breakdown unavailable" note instead.
 */
export function buildScoreBreakdown(ticker: ScreenerTicker): ScoreBreakdown | null {
  if (!ticker.signals) return null;

  const fired = new Set(ticker.signals);
  const checks: ScoreCheckResult[] = SCORE_CHECKS.map((check) => {
    const rule = check.rules.find((r) => fired.has(r.signal)) ?? null;
    const measured = check.measure(ticker);
    let reason: string;
    if (rule) {
      // Just the reading. Repeating the rule's own wording here restates the
      // column beside it — which already marks the matched rule — and reads
      // as a tautology ("P/E 12.6 — P/E under 15").
      reason = measured ? `${measured}.` : `${rule.label}.`;
    } else if (measured) {
      reason = `${measured} — ${check.neutral}`;
    } else {
      reason = 'This reading is missing from the latest scan, so the check was skipped.';
    }
    return {
      key: check.key,
      title: check.title,
      question: check.question,
      rules: check.rules,
      fired: rule,
      points: rule?.points ?? 0,
      measured,
      reason,
    };
  });

  const unknownSignals = ticker.signals.filter((signal) => !RULE_INDEX.has(signal));
  // Unknown tags still carry unknown weight, so they are reported but cannot
  // be added up — which is precisely why `reconciles` may come back false.
  const subtotal = SCORE_BASE + checks.reduce((sum, check) => sum + check.points, 0);
  const clampedTotal = Math.max(SCORE_MIN, Math.min(SCORE_MAX, subtotal));
  const published = ticker.score ?? null;

  return {
    base: SCORE_BASE,
    checks,
    subtotal,
    published,
    clamped: clampedTotal !== subtotal,
    reconciles: published == null || Math.round(published) === clampedTotal,
    unknownSignals,
  };
}

/** Inputs the screener filters on that are NOT part of the score. */
export const NON_SCORING_FIELDS = [
  'Market cap',
  'Dividend yield',
  'Sector',
  'Index membership',
] as const;
