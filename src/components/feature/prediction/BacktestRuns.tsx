// components/feature/prediction/BacktestRuns.tsx — the committed backtest runs,
// with the methodology stated rather than implied.
//
// Every number here is read from data/backtests/*.json or derived from it at
// build time (lib/backtests/coverage.ts). Nothing is carried over from the
// legacy assets/js/backtest-research.js, which hardcoded figures — "IS Sharpe
// of 2.22", "135,000+ trades", "74.3% win rate over 25 years" — as static
// strings with no artifact behind them in this repo.
'use client';

import React, { useState } from 'react';
import { InfoTip } from '@/components/primitives';
import { STRATEGY_SPECS, paramLabel, strategyTitle } from '@/lib/backtests/strategies';
import type { BacktestCoverage, BacktestRun } from '@/lib/backtests/coverage';

// Non-finite values reach here on purpose: the source files carry a literal
// `Infinity` for profit factor when a run had no losing trades, and dropping
// them to "—" would hide a meaningful result behind a missing-data dash.
const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);

const pct = (v: number | null | undefined, digits = 2) => (finite(v) ? `${v.toFixed(digits)}%` : '—');

const money = (v: number | null | undefined) =>
  finite(v) ? `$${Math.round(v).toLocaleString('en-US')}` : '—';

const num = (v: number | null | undefined, digits = 2) => (finite(v) ? v.toFixed(digits) : '—');

const returnColor = (v: number | null | undefined) =>
  v == null ? 'var(--color-text-primary)' : v > 0 ? 'var(--color-bull)' : v < 0 ? 'var(--color-bear)' : 'var(--color-text-primary)';

function Row({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 py-2 sm:grid-cols-[9.5rem_1fr] sm:gap-3">
      <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)] sm:pt-0.5">
        {label}
      </dt>
      <dd className="text-sm leading-relaxed text-[var(--color-text-secondary)]">{children}</dd>
    </div>
  );
}

function RunDetail({ run }: { run: BacktestRun }) {
  const spec = STRATEGY_SPECS[run.strategy];
  const d = run.derived;
  const r = run.results;
  const paramKeys = Object.keys(run.params);

  return (
    <div className="border-t p-4" style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-base)' }}>
      <dl className="divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <Row label="Date range">
          {run.start} to {run.end}
          {d.windowDays != null && (
            <span className="text-[var(--color-text-tertiary)]">
              {' '}— {d.windowDays.toLocaleString('en-US')} calendar days
            </span>
          )}
        </Row>

        <Row label="Universe">
          {/* "Universe" for a single-instrument run is one instrument. Saying so
              plainly matters more than the word: a rule tested on one ETF over
              one window is a single observation, not a strategy validated
              across a market. */}
          One instrument: <strong className="text-[var(--color-text-primary)]" data-numeric>{run.ticker}</strong>.
          This run tested the rule on that ticker alone — not across a list of stocks — so it says nothing about how
          the rule behaves elsewhere.
        </Row>

        <Row label="Entry rule">
          {spec ? spec.entry(run.params) : 'Not described for this rule family.'}
        </Row>

        <Row label="Exit rule">
          {spec ? spec.exit(run.params) : 'Not described for this rule family.'}
          {' '}There is no stop-loss or profit target in the recorded parameters: the exit condition above is the only
          way a position closes.
        </Row>

        <Row label="Settings used">
          {paramKeys.length ? (
            <ul className="space-y-0.5">
              {paramKeys.map((key) => (
                <li key={key} data-numeric>
                  <span className="text-[var(--color-text-primary)]">{String(run.params[key])}</span>
                  <span className="text-[var(--color-text-tertiary)]"> — {paramLabel(run.strategy, key)}</span>
                </li>
              ))}
            </ul>
          ) : (
            'None recorded.'
          )}
        </Row>

        <Row label="Rebalance frequency">
          {/* The honest answer, computed from the trades rather than asserted. */}
          None — this rule has no schedule. It buys and sells whenever its condition is met, so the cadence is a
          result, not a setting.{' '}
          {d.closedTrades > 0 ? (
            <>
              It traded <strong className="text-[var(--color-text-primary)]" data-numeric>{d.closedTrades}</strong>{' '}
              {d.closedTrades === 1 ? 'time' : 'times'} in this window
              {d.tradesPerYear != null && <> — about {d.tradesPerYear.toFixed(1)} a year</>}, holding each position a
              median of <strong className="text-[var(--color-text-primary)]" data-numeric>{d.medianHoldDays}</strong> days
              {d.minHoldDays != null && d.maxHoldDays != null && d.minHoldDays !== d.maxHoldDays && (
                <> (shortest {d.minHoldDays}, longest {d.maxHoldDays})</>
              )}
              .
              {d.exposurePct != null && (
                <> It held a position on about {d.exposurePct.toFixed(0)}% of the days in the window and sat in cash the rest.</>
              )}
            </>
          ) : (
            'It never completed a trade in this window.'
          )}
          {d.openAtEnd > 0 && (
            <>
              {' '}One more position was still open when the window ended, so it has no exit price and is not in the
              trade list below.
            </>
          )}
        </Row>

        <Row label="Results">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px] text-sm">
              <tbody>
                <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">Account grew from</td>
                  <td className="py-1.5 text-right text-[var(--color-text-primary)]" data-numeric>
                    {money(r.starting_cash)} → {money(r.ending_value)}
                  </td>
                </tr>
                <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">Account return</td>
                  <td className="py-1.5 text-right font-semibold" data-numeric style={{ color: returnColor(d.simpleReturnPct) }}>
                    {pct(d.simpleReturnPct)}
                  </td>
                </tr>
                {d.reportedIsLogReturn && (
                  // Not a rounding quibble: on the GLD run the file says
                  // "14.15" for an account that actually grew 15.20%.
                  <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                      Return as recorded in the file
                    </td>
                    <td className="py-1.5 text-right text-[var(--color-text-secondary)]" data-numeric>
                      {pct(r.total_return_pct)} — a log return, not the plain change
                    </td>
                  </tr>
                )}
                <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                    <InfoTip term="sharpe">Sharpe</InfoTip>
                  </td>
                  <td className="py-1.5 text-right text-[var(--color-text-primary)]" data-numeric>{num(r.sharpe)}</td>
                </tr>
                <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">Worst fall from a peak</td>
                  <td className="py-1.5 text-right text-[var(--color-text-primary)]" data-numeric>
                    {pct(r.max_drawdown_pct)}
                    {r.max_drawdown_days != null && (
                      <span className="text-[var(--color-text-tertiary)]"> over {r.max_drawdown_days} days</span>
                    )}
                  </td>
                </tr>
                <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                    <InfoTip term="win_rate">Win rate</InfoTip> on closed trades
                  </td>
                  <td className="py-1.5 text-right text-[var(--color-text-primary)]" data-numeric>
                    {pct(d.closedWinRatePct, 1)}
                    <span className="text-[var(--color-text-tertiary)]"> ({r.won_trades ?? '—'} of {d.closedTrades})</span>
                  </td>
                </tr>
                {d.openAtEnd > 0 && (
                  // The file's win_rate_pct divides wins by num_trades, which
                  // includes the unfinished position — so an open trade is
                  // silently counted as a non-win and the figure comes out low.
                  <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">Win rate as recorded in the file</td>
                    <td className="py-1.5 text-right text-[var(--color-text-secondary)]" data-numeric>
                      {pct(r.win_rate_pct, 1)} — counts the unfinished position as a non-win
                    </td>
                  </tr>
                )}
                <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">
                    <InfoTip term="profit_factor">Profit factor</InfoTip>
                  </td>
                  <td className="py-1.5 text-right text-[var(--color-text-primary)]" data-numeric>
                    {r.profit_factor === Infinity ? (
                      <span className="text-[var(--color-text-secondary)]">
                        No losing trades — nothing to divide by
                      </span>
                    ) : (
                      num(r.profit_factor)
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-3 text-[var(--color-text-tertiary)]">Every trade&apos;s % return, compounded</td>
                  <td className="py-1.5 text-right text-[var(--color-text-primary)]" data-numeric>
                    {pct(d.compoundedTradeReturnPct)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Row>

        {/* The single most misleading thing about these runs if left unsaid. */}
        {d.compoundedTradeReturnPct != null &&
          d.simpleReturnPct != null &&
          Math.abs(d.compoundedTradeReturnPct) > 1 &&
          Math.abs(d.compoundedTradeReturnPct - d.simpleReturnPct) > Math.abs(d.compoundedTradeReturnPct) * 0.5 && (
            <Row label="Position size">
              The trades themselves compounded to {pct(d.compoundedTradeReturnPct)}, but the account only moved{' '}
              {pct(d.simpleReturnPct)}. That gap means the run put a small fixed stake into each trade rather than the
              whole account — so the account return here is not what this rule would have returned fully invested, and
              the two figures answer different questions. The stake size is not recorded in the file.
            </Row>
          )}

        {run.trades.length > 0 && (
          <Row label="Every trade">
            <div className="overflow-x-auto">
              <table className="mg-table mg-table-tight w-full min-w-[380px]">
                <thead>
                  <tr className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
                    <th scope="col" className="py-1.5 text-left font-medium">Bought</th>
                    <th scope="col" className="py-1.5 text-left font-medium">Sold</th>
                    <th scope="col" className="py-1.5 text-right font-medium">In</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Out</th>
                    <th scope="col" className="py-1.5 text-right font-medium">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {run.trades.map((trade, i) => (
                    <tr key={`${trade.entry_date}-${i}`} className="border-t" style={{ borderColor: 'var(--color-border-subtle)' }}>
                      <td className="py-1.5 text-[var(--color-text-secondary)]" data-numeric>{trade.entry_date}</td>
                      <td className="py-1.5 text-[var(--color-text-secondary)]" data-numeric>{trade.exit_date}</td>
                      <td className="py-1.5 text-right text-[var(--color-text-secondary)]" data-numeric>${trade.entry_price?.toFixed(2)}</td>
                      <td className="py-1.5 text-right text-[var(--color-text-secondary)]" data-numeric>${trade.exit_price?.toFixed(2)}</td>
                      <td className="py-1.5 text-right font-medium" data-numeric style={{ color: returnColor(trade.pnl_pct) }}>
                        {trade.pnl_pct >= 0 ? '+' : ''}{trade.pnl_pct?.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Row>
        )}

        <Row label="What this can't tell you">
          The rule was tested on one instrument over one window, and{' '}
          {d.closedTrades < 30
            ? `${d.closedTrades} ${d.closedTrades === 1 ? 'trade is' : 'trades are'} far too few to separate skill from luck — a hundred is the usual minimum quoted for that`
            : `${d.closedTrades} trades is still below the hundred usually quoted as a minimum for separating skill from luck`}
            . Trading costs, the spread between buying and selling prices, dividends and tax are not visible in these
            files. And it was chosen and run after the fact on prices that had already happened.
        </Row>
      </dl>
    </div>
  );
}

export function BacktestRuns({ coverage }: { coverage: BacktestCoverage }) {
  const { runs, unreadable } = coverage;
  const [open, setOpen] = useState<string | null>(runs[0]?.file ?? null);

  if (!runs.length && !unreadable.length) return null;

  const strategies = [...new Set(runs.map((run) => run.strategy))];
  const tickers = [...new Set(runs.map((run) => run.ticker))];
  const totalClosed = runs.reduce((sum, run) => sum + run.derived.closedTrades, 0);
  const windows = [...new Set(runs.map((run) => `${run.start} to ${run.end}`))].sort();

  return (
    <div
      className="rounded-[var(--radius-tile)] border overflow-hidden"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">
          Individual Backtest Runs — Methodology and Results
        </h3>
      </div>
      <div className="p-4">
        <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
          {runs.length} saved {runs.length === 1 ? 'run' : 'runs'}: {strategies.length}{' '}
          {strategies.length === 1 ? 'rule' : 'rules'} ({strategies.map(strategyTitle).join(', ')}) tested on{' '}
          {tickers.length} {tickers.length === 1 ? 'instrument' : 'instruments'} ({tickers.join(', ')}) across{' '}
          {windows.length === 1 ? `one window, ${windows[0]}` : `${windows.length} windows, ${windows[0]} through ${windows[windows.length - 1]}`},
          producing {totalClosed} completed trades in total. Open any run for its full method — the exact dates, what
          it bought and sold on, how often it traded and what came out.
        </p>
        {unreadable.length > 0 && (
          // A count that quietly excludes files nobody could read is a claim of
          // completeness the page has not earned.
          <p
            className="mt-2 rounded-lg border px-3 py-2 text-xs leading-relaxed"
            style={{ borderColor: 'var(--color-caution)', color: 'var(--color-text-secondary)' }}
          >
            {unreadable.length} more saved {unreadable.length === 1 ? 'run' : 'runs'} could not be read and{' '}
            {unreadable.length === 1 ? 'is' : 'are'} missing from the totals above: {unreadable.join(', ')}.
          </p>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
          Simulated results on prices that had already happened. No money was at risk and past performance does not
          predict future results. The engine that ran these lives in a separate repository
          (arshad1416/hermes-scripts) — only its output is stored here, so the entry and exit wording describes the
          standard form of each named rule filled in with the settings the run recorded, not a reading of the executing
          code. The trade list under each run is the record of what it actually did.
        </p>

        <ul className="mt-4 space-y-2">
          {runs.map((run) => {
            const isOpen = open === run.file;
            const d = run.derived;
            return (
              <li
                key={run.file}
                className="overflow-hidden rounded-lg border"
                style={{ borderColor: 'var(--color-border-subtle)' }}
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : run.file)}
                  aria-expanded={isOpen}
                  className="flex min-h-11 w-full flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-left transition-colors hover:bg-[var(--color-bg-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
                  style={{ backgroundColor: isOpen ? 'var(--color-bg-elevated)' : undefined }}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="text-[var(--color-text-tertiary)]"
                      style={{ transform: isOpen ? 'rotate(90deg)' : undefined, display: 'inline-block', transition: 'transform 120ms' }}
                    >
                      ›
                    </span>
                    <span className="font-semibold text-[var(--color-text-primary)]" data-numeric>{run.ticker}</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{strategyTitle(run.strategy)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-3 text-xs" data-numeric>
                    <span className="text-[var(--color-text-tertiary)]">{run.start} → {run.end}</span>
                    <span className="text-[var(--color-text-tertiary)]">
                      {d.closedTrades} {d.closedTrades === 1 ? 'trade' : 'trades'}
                    </span>
                    <span className="font-semibold" style={{ color: returnColor(d.simpleReturnPct) }}>
                      {d.simpleReturnPct != null && d.simpleReturnPct > 0 ? '+' : ''}
                      {pct(d.simpleReturnPct)}
                    </span>
                  </span>
                </button>
                {isOpen && <RunDetail run={run} />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
