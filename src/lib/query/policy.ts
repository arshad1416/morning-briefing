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
// Every value is read off the generator's real cron in pi-scripts/crontab.txt,
// because a threshold tighter than the cadence paints a healthy pipeline amber
// and one much looser never fires at all. Cadences differ by two orders of
// magnitude across the /models/ tiles, so a single shared number cannot work.
export const STALE_AFTER = {
  // accuracy.json (09:35/16:35), prediction-engine.json (09:40/16:40) and
  // simulation.json all regenerate on WEEKDAYS only, so the longest healthy gap
  // is Friday afternoon to Monday morning — ~65h.
  models: 72 * 3_600_000,
  // walk_forward_v2.json: `0 6 * * 0`, once a week on Sunday. 9 days leaves a
  // healthy week untouched while still catching a run that never happened.
  walkForward: 9 * 86_400_000,
  // crypto-cohorts.json: `13,28,43,58 * * * *`, every 15 min. One missed run is
  // tolerated; two is worth the amber dot.
  cryptoCohorts: 25 * 60_000,
  // options-status.json: `8,38 * * * *`, every 30 min — same 40 min the options
  // page already allows its own feed.
  optionsStatus: 40 * 60_000,
} as const;
