// lib/backtests/coverage.ts — build-time manifest of data/backtests/*.json.
//
// Server-only: reads the filesystem at build, same pattern as
// lib/seo/ticker-coverage.ts. The result is passed as a prop into the client
// Research page, so nothing here ships to the browser.
//
// These runs were sitting unused in data/backtests/ — the Backtest tab only
// ever showed the Pro-gated walk-forward summary, which states no methodology
// at all. Each file carries everything a methodology statement needs: the
// window (in its filename), the instrument, the rule parameters, the results
// and every closed trade.
//
// The `equity_curve` (600+ points per file) is deliberately dropped. Everything
// derived from it that the page needs — the drawdown — is already in `results`.
import fs from 'node:fs';
import path from 'node:path';
import { parseTolerantJson } from '@/lib/json';

export type BacktestTrade = {
  entry_date: string;
  exit_date: string;
  entry_price: number;
  exit_price: number;
  pnl_pct: number;
};

export type BacktestResults = {
  sharpe?: number;
  total_return_pct?: number;
  max_drawdown_pct?: number;
  max_drawdown_days?: number;
  win_rate_pct?: number;
  num_trades?: number;
  avg_trade_pct?: number;
  avg_win_pct?: number;
  avg_loss_pct?: number;
  profit_factor?: number;
  won_trades?: number;
  lost_trades?: number;
  starting_cash?: number;
  ending_value?: number;
};

export type BacktestRun = {
  file: string;
  ticker: string;
  strategy: string;
  /** Window from the filename — the only place the date range is recorded. */
  start: string;
  end: string;
  params: Record<string, number | string>;
  results: BacktestResults;
  trades: BacktestTrade[];
  derived: BacktestDerived;
};

export type BacktestDerived = {
  /** (ending / starting − 1). See `reportedIsLogReturn`. */
  simpleReturnPct: number | null;
  /**
   * True when `results.total_return_pct` is the LOG return rather than the
   * plain percentage change — verified against every file in the corpus, where
   * it matches ln(ending/starting)×100 to the cent. It only diverges visibly
   * once a run makes real money: a +15.20% account is reported as "14.15%".
   */
  reportedIsLogReturn: boolean;
  /** Trades that actually closed inside the window. */
  closedTrades: number;
  /**
   * `results.num_trades` counts one more trade than the closed list whenever a
   * position was still open when the window ended. Observed in 4 of the 11
   * runs, and always by exactly one.
   */
  openAtEnd: number;
  /** Wins ÷ closed trades. */
  closedWinRatePct: number | null;
  /** Wins ÷ num_trades — what `results.win_rate_pct` reports. */
  reportedWinRatePct: number | null;
  medianHoldDays: number | null;
  minHoldDays: number | null;
  maxHoldDays: number | null;
  /** Calendar days holding something, as a share of the whole window. */
  exposurePct: number | null;
  windowDays: number | null;
  tradesPerYear: number | null;
  /** Every closed trade's % return, compounded. */
  compoundedTradeReturnPct: number | null;
};

const DAY_MS = 86_400_000;

const days = (from: string, to: string): number | null => {
  const a = Date.parse(from);
  const b = Date.parse(to);
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY_MS) : null;
};

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function derive(results: BacktestResults, trades: BacktestTrade[], start: string, end: string): BacktestDerived {
  const starting = results.starting_cash;
  const ending = results.ending_value;
  const simpleReturnPct =
    starting != null && ending != null && starting > 0 ? (ending / starting - 1) * 100 : null;

  let reportedIsLogReturn = false;
  if (simpleReturnPct != null && results.total_return_pct != null && starting && ending) {
    const log = Math.log(ending / starting) * 100;
    // Both definitions agree to 2dp on tiny returns, so only claim the log
    // reading where it actually differs from the simple one.
    reportedIsLogReturn =
      Math.abs(results.total_return_pct - log) < 0.02 &&
      Math.abs(results.total_return_pct - simpleReturnPct) >= 0.02;
  }

  const holds = trades
    .map((trade) => days(trade.entry_date, trade.exit_date))
    .filter((n): n is number => n != null && n >= 0);
  const windowDays = days(start, end);
  const daysHeld = holds.reduce((sum, n) => sum + n, 0);
  const wins = trades.filter((trade) => (trade.pnl_pct ?? 0) > 0).length;

  const compounded = trades.length
    ? (trades.reduce((product, trade) => product * (1 + (trade.pnl_pct ?? 0) / 100), 1) - 1) * 100
    : null;

  return {
    simpleReturnPct,
    reportedIsLogReturn,
    closedTrades: trades.length,
    openAtEnd: Math.max(0, (results.num_trades ?? trades.length) - trades.length),
    closedWinRatePct: trades.length ? (wins / trades.length) * 100 : null,
    reportedWinRatePct: results.num_trades ? (wins / results.num_trades) * 100 : null,
    medianHoldDays: median(holds),
    minHoldDays: holds.length ? Math.min(...holds) : null,
    maxHoldDays: holds.length ? Math.max(...holds) : null,
    exposurePct: windowDays && windowDays > 0 ? (daysHeld / windowDays) * 100 : null,
    windowDays,
    tradesPerYear:
      windowDays && windowDays > 0 ? (trades.length / windowDays) * 365 : null,
    compoundedTradeReturnPct: compounded,
  };
}

/** `TICKER_strategy_name_YYYY-MM-DD_YYYY-MM-DD.json` */
const FILENAME = /^(.+?)_(.+)_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})\.json$/;

export type BacktestCoverage = {
  runs: BacktestRun[];
  /** Files present but unreadable — reported rather than silently dropped. */
  unreadable: string[];
};

export function getBacktestCoverage(): BacktestCoverage {
  const directory = path.join(process.cwd(), 'data', 'backtests');
  let names: string[];
  try {
    names = fs.readdirSync(directory).filter((name) => name.endsWith('.json'));
  } catch {
    return { runs: [], unreadable: [] };
  }

  const unreadable: string[] = [];
  const runs = names
    .flatMap((name): BacktestRun[] => {
      const match = FILENAME.exec(name);
      if (!match) {
        unreadable.push(name);
        return [];
      }
      try {
        const payload = parseTolerantJson(
          fs.readFileSync(path.join(directory, name), 'utf8'),
        ) as Partial<{ ticker: string; strategy: string; params: Record<string, number | string>; results: BacktestResults; trades: BacktestTrade[] }>;
        const results: BacktestResults = payload.results ?? {};
        const trades: BacktestTrade[] = Array.isArray(payload.trades) ? payload.trades : [];
        const [, fileTicker, fileStrategy, start, end] = match;
        return [{
          file: name,
          // Prefer the file's own fields; the filename is the fallback and the
          // only source for the window.
          ticker: String(payload.ticker || fileTicker).toUpperCase(),
          strategy: String(payload.strategy || fileStrategy),
          start,
          end,
          params: payload.params ?? {},
          results,
          trades,
          derived: derive(results, trades, start, end),
        }];
      } catch {
        unreadable.push(name);
        return [];
      }
    })
    .sort(
      (a, b) =>
        a.strategy.localeCompare(b.strategy) ||
        a.ticker.localeCompare(b.ticker) ||
        a.start.localeCompare(b.start) ||
        a.end.localeCompare(b.end),
    );

  return { runs, unreadable: unreadable.sort() };
}
