// lib/query/policy.ts — polling policy
export const POLL = {
  market:  { stale: 5_000,    live: 5_000  },
  verdict: { stale: 60_000,   live: 60_000 },
  options: { stale: 30_000,   live: 60_000 },
  news:    { stale: 120_000,  live: 120_000},
  backtest:{ stale: Infinity, live: false  },
  calendar:{ stale: 300_000,  live: false  },
} as const;
