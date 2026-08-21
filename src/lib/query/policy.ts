// lib/query/policy.ts — polling policy
export const POLL = {
  market:  { stale: 5_000,    live: 5_000  },
  verdict: { stale: 60_000,   live: 60_000 },
  options: { stale: 30_000,   live: 60_000 },
  news:    { stale: 120_000,  live: 120_000},
  backtest:{ stale: Infinity, live: false  },
  calendar:{ stale: 300_000,  live: false  },
} as const;

// How old a payload must be before DataFreshness paints its dot amber. This is
// a DISPLAY threshold, deliberately separate from POLL.*.stale above, which
// governs refetching — the same word otherwise means two things in one file.
//
// models: accuracy.json (09:35/16:35) and prediction-engine.json (09:40/16:40)
// regenerate on WEEKDAYS only, so the longest healthy gap is Friday afternoon
// to Monday morning, ~65h. A tighter threshold reads amber every weekend while
// the pipeline is perfectly well.
export const STALE_AFTER = {
  models: 72 * 3_600_000,
} as const;
