// app/predictions/predictions-client.tsx — Prediction Engine tuning, ported
// from the legacy SPA: version history, live-trading accuracy vs backtest
// predictions, expectancy/drawdown metrics, iteration insights, and the
// López de Prado-style backtest validation scorecard.
//
// Data (all Pro tier via the Worker gate): prediction-engine.json,
// accuracy.json, walk_forward_v2.json.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { GateCard } from '@/components/feature/gating/GateCard';
import { InfoTip } from '@/components/primitives';
import { fetchGated, GateError } from '@/lib/api/gated';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const raw = { parse: (d: unknown) => d as Any };

const useGatedFile = (name: string, file: string) =>
  useQuery<Any>({
    queryKey: ['predictions', name],
    queryFn: () => fetchGated<Any>(file, raw),
    staleTime: 300_000,
    retry: false,
  });

/* ------------------------------------------------------------------ */
/*  Atoms                                                             */
/* ------------------------------------------------------------------ */

function Card({ title, right, children }: { title?: React.ReactNode; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    // No `overflow-hidden` here: the card titles carry <InfoTip>, whose tooltip
    // renders above its trigger. Clipping the card would put the tooltip of a
    // header — the topmost element — outside the box and hide the explanation.
    <div
      className="rounded-[var(--radius-tile)] border"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      {title && (
        <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{title}</h3>
          {right}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function Metric({ label, value, sub, color }: { label: React.ReactNode; value: React.ReactNode; sub?: string; color?: string }) {
  return (
    <div
      className="rounded-[var(--radius-tile)] border p-3 text-center"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-xl font-bold" data-numeric style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</p>
      {sub && <p className="text-[10px] text-[var(--color-text-tertiary)]">{sub}</p>}
    </div>
  );
}

function WrBadge({ wr, hi = 70, mid = 60 }: { wr: number; hi?: number; mid?: number }) {
  const color = wr >= hi ? 'var(--color-bull)' : wr >= mid ? 'var(--color-caution)' : 'var(--color-text-tertiary)';
  return (
    <span
      className="inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold"
      data-numeric
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {wr}%
    </span>
  );
}

const pnlColor = (v: number) => ((v ?? 0) >= 0 ? 'var(--color-bull)' : 'var(--color-bear)');
const signed = (v: number) => `${(v ?? 0) >= 0 ? '+' : ''}${v}%`;

const TH = ({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center' }) => (
  <th className={`px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] text-${align}`}>{children}</th>
);
const TD = ({ children, align = 'left', color, bold }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; color?: string; bold?: boolean }) => (
  <td
    className={`border-t px-3 py-2 text-${align} ${bold ? 'font-semibold' : ''}`}
    data-numeric
    style={{ borderColor: 'var(--color-border-subtle)', color: color ?? 'var(--color-text-secondary)' }}
  >
    {children}
  </td>
);

/* ------------------------------------------------------------------ */
/*  Sections                                                          */
/* ------------------------------------------------------------------ */

function LiveTrading({ lt }: { lt: Any }) {
  const s = lt.summary || {};
  return (
    <Card
      title={<InfoTip term="paper_trading">Live Paper-Trading Accuracy</InfoTip>}
      right={<span className="text-[10px] text-[var(--color-text-tertiary)]" data-numeric>Updated {(s.generated_at || lt.generated_at || '').substring(0, 16)}</span>}
    >
      <div className="mb-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Metric label={<InfoTip term="win_rate">Live Win Rate</InfoTip>} value={`${s.win_rate}%`} sub="of closed trades" color={s.win_rate >= 60 ? 'var(--color-bull)' : s.win_rate >= 40 ? 'var(--color-caution)' : 'var(--color-bear)'} />
        <Metric label="Closed Trades" value={s.closed_trades} sub="bought and sold" />
        <Metric label={<InfoTip term="w_l">W / L</InfoTip>} value={<><span style={{ color: 'var(--color-bull)' }}>{s.winning_trades}W</span> / <span style={{ color: 'var(--color-bear)' }}>{s.losing_trades}L</span></>} />
        <Metric label="Return" value={`${s.return_pct}%`} color={pnlColor(s.return_pct)} />
        <Metric label="Days Active" value={s.trading_days_active} />
        <Metric label="Open Positions" value={s.open_positions} sub="still running" />
      </div>
      {!!lt.per_strategy?.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr><TH>Strategy</TH><TH align="center">Trades</TH><TH align="center">W/L</TH><TH align="center">Live Win Rate</TH><TH align="center"><InfoTip term="backtest">Backtest Win Rate</InfoTip></TH><TH align="center">Status</TH><TH align="right"><InfoTip term="avg_pnl">Avg Return</InfoTip></TH></tr></thead>
            <tbody>
              {lt.per_strategy.map((p: Any, i: number) => {
                const predVal = parseFloat(p.backtest_predicted_wr);
                const diff = !isNaN(predVal) && predVal > 0 ? (p.win_rate || 0) - predVal : null;
                const dot = diff == null ? '' : diff > 5 ? '🟢' : diff < -5 ? '🔴' : '⚪';
                return (
                  <tr key={i}>
                    <TD bold color="var(--color-text-primary)">{p.strategy}</TD>
                    <TD align="center">{p.closed_trades}</TD>
                    <TD align="center"><span style={{ color: 'var(--color-bull)' }}>{p.wins}</span>/<span style={{ color: 'var(--color-bear)' }}>{p.losses}</span></TD>
                    <TD align="center"><WrBadge wr={p.win_rate || 0} hi={60} mid={40} /></TD>
                    <TD align="center">{p.backtest_predicted_wr || 'N/A'}</TD>
                    <TD align="center">{dot} <span className="text-[10px]">{String(p.accuracy_vs_prediction || '').substring(0, 24)}</span></TD>
                    <TD align="right" color={pnlColor(p.avg_pnl_pct || 0)}>{signed(p.avg_pnl_pct || 0)}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 border-t pt-2 text-[10px] text-[var(--color-text-tertiary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>
        🟢 Beating its backtest · ⚪ On track · 🔴 Behind its backtest. The backtest win rate is each strategy&apos;s{' '}
        <InfoTip term="walk_forward">walk-forward</InfoTip> result — the benchmark the live results are measured against.
      </p>
    </Card>
  );
}

function VersionTable({ title, rows }: { title: string; rows: [string, Any][] }) {
  return (
    <Card title={title}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead><tr><TH>Version</TH><TH align="right">Trades</TH><TH align="right"><InfoTip term="avg_pnl">Avg Return</InfoTip></TH><TH align="center"><InfoTip term="win_rate">Win Rate</InfoTip></TH><TH align="right"><InfoTip term="pf">Profit Factor</InfoTip></TH><TH>Innovation</TH></tr></thead>
          <tbody>
            {rows.map(([name, d]) => {
              const p = d.performance?.overall || {};
              return (
                <tr key={name} style={p.is_best || p.star ? { backgroundColor: 'var(--color-accent-dim)' } : undefined}>
                  <TD bold color="var(--color-text-primary)">{name.split(' ')[0]}</TD>
                  <TD align="right">{d.total_trades?.toLocaleString?.() ?? ''}</TD>
                  <TD align="right" color={pnlColor(p.avg_pnl)}>{signed(p.avg_pnl)}</TD>
                  <TD align="center"><WrBadge wr={p.win_rate ?? 0} /></TD>
                  <TD align="right">{p.profit_factor}</TD>
                  <td className="border-t px-3 py-2 text-xs text-[var(--color-text-tertiary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>
                    {String(d.description || '').substring(0, 80)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function EnhancedAccuracy() {
  const q = useGatedFile('accuracy', 'accuracy.json');
  const d = q.data;
  if (!d?.expectancy) return null;
  const exp = d.expectancy;
  const dd = d.drawdown || {};
  const slip = d.slippage || {};
  return (
    <Card title={<InfoTip term="live_simulation">Live Simulation Metrics</InfoTip>}>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Metric label={<InfoTip term="expectancy">Expectancy</InfoTip>} value={signed(exp.expectancy_pct)} sub="average per closed trade" color={pnlColor(exp.expectancy_pct)} />
        <Metric label={<InfoTip term="profit_factor">Profit Factor</InfoTip>} value={typeof exp.profit_factor === 'number' ? exp.profit_factor.toFixed(2) : '∞'} sub="total gains ÷ total losses" color={exp.profit_factor >= 1.5 ? 'var(--color-bull)' : 'var(--color-caution)'} />
        <Metric label={<InfoTip term="max_drawdown">Max Drawdown</InfoTip>} value={`-${dd.max_drawdown_pct || 0}%`} sub={`${dd.drawdown_duration_trades || 0} trades from peak to low`} color={dd.max_drawdown_pct < 10 ? 'var(--color-bull)' : dd.max_drawdown_pct < 20 ? 'var(--color-caution)' : 'var(--color-bear)'} />
        <Metric label={<InfoTip term="kelly">Kelly %</InfoTip>} value={`${exp.kelly_fraction || 0}%`} sub="half the formula’s stake, capped" />
        {slip.n_measured > 0 && <Metric label={<InfoTip term="slippage">Avg Slippage</InfoTip>} value={`${slip.avg_slippage_pct}%`} sub={`expected vs actual · ${slip.n_measured} trades`} color="var(--color-caution)" />}
      </div>
      {!!d.per_strategy?.length && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr><TH>Strategy</TH><TH align="center">Trades</TH><TH align="center">Win Rate</TH><TH align="center">Expectancy</TH><TH align="center">Profit Factor</TH><TH align="center">Max Drawdown</TH><TH align="center">Status</TH></tr></thead>
            <tbody>
              {d.per_strategy.map((s: Any, i: number) => (
                <tr key={i}>
                  <TD bold color="var(--color-text-primary)">{s.strategy}</TD>
                  <TD align="center">{s.n_trades}</TD>
                  <TD align="center">{s.win_rate}%</TD>
                  <TD align="center" color={pnlColor(s.expectancy_pct)} bold>{signed(s.expectancy_pct)}</TD>
                  <TD align="center">{typeof s.profit_factor === 'number' ? s.profit_factor.toFixed(2) : '∞'}</TD>
                  <TD align="center" color={s.max_drawdown_pct < 10 ? 'var(--color-bull)' : s.max_drawdown_pct < 20 ? 'var(--color-caution)' : 'var(--color-bear)'}>-{s.max_drawdown_pct}%</TD>
                  <TD align="center" color={s.status === 'profitable' ? 'var(--color-bull)' : 'var(--color-bear)'}>{s.status === 'profitable' ? 'Profitable' : 'Losing'}</TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 border-t pt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>
        Returns here are percentages of the money put into each trade, not dollar amounts. Max drawdown is the worst run
        of losses when the closed practice trades are chained together one after another, so it does not account for how
        much of the account each trade actually used.
      </p>
    </Card>
  );
}

function Validation({ data }: { data: Any }) {
  const wfq = useGatedFile('walk-forward', 'walk_forward_v2.json');
  const s = data.summary || {};
  const totalTrades = s.total_backtest_trades || 0;
  const parseMetric = (str: unknown) => {
    const m = String(str ?? '').match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : 0;
  };
  const bestWR = parseMetric(s.best_win_rate);
  const bestPF = parseMetric(s.best_profit_factor);

  // FIX (MEDIUM data bug): this used to read a top-level `windows` array that
  // walk_forward_v2.json does not carry — WalkForwardTile.tsx and
  // research-client.tsx's BacktestTab both parse the very same file via a
  // `summary` record keyed by strategy name (WalkForwardTile even enforces
  // that shape with a zod schema), so the `windows` lookup here always found
  // nothing and this card silently fell back to "Not yet run" even when real
  // walk-forward data was available elsewhere on the site. Now reads
  // `summary` like its two siblings and aggregates per strategy instead of
  // per (nonexistent) window.
  const wf = (() => {
    const summary = wfq.data?.summary;
    if (!summary || typeof summary !== 'object') return null;
    const keys = Object.keys(summary);
    if (!keys.length) return null;
    const strategies = keys.map((k) => {
      const st = summary[k] || {};
      const oos = st.avg_oos_sharpe ?? 0;
      const deg = st.avg_degradation_pct ?? 0;
      return { pass: deg < 30 && oos > 0, oos, deg };
    });
    const good = strategies.filter((x: Any) => x.pass).length;
    const avgOOS = strategies.reduce((sum: number, x: Any) => sum + x.oos, 0) / strategies.length;
    const avgDeg = strategies.reduce((sum: number, x: Any) => sum + x.deg, 0) / strategies.length;
    return {
      count: strategies.length,
      good,
      avgOOS,
      avgDeg,
      robust: good >= Math.ceil(strategies.length * 0.6),
    };
  })();

  const dateRange = s.date_range || '2000-2026';
  const winRate = bestWR / 100;
  const tickers = s.tickers_tested || 59;

  // FIX: this scorecard used to carry two more "checks" here — a
  // "Win Rate / Reward-to-Risk" tile whose R:R was back-solved algebraically
  // from bestPF and winRate (estRR = bestPF * (1 - winRate) / winRate), and a
  // "Live Sharpe (est.)" tile computed as (bestWR - 50) / 15, then cut by 30%.
  // Neither figure is a measured trade statistic: no return series or
  // volatility ever enters the calculation, and no Sharpe ratio is computed
  // anywhere in this codebase — both were a linear rescale of the win rate
  // dressed up as a risk-adjusted metric. Removed rather than relabelled;
  // the win-rate check below uses only the real, measured win rate, and
  // Profit Factor (already its own check above) is the other real figure
  // that survives.
  const checks: Array<{ id: string; label: React.ReactNode; pass: boolean; value: string; detail: string }> = [
    // FIX (MEDIUM data bug): totalTrades/1000 rounded to 0 decimals printed
    // "0K trades" for any total under 500 — including totals that already
    // pass the >= 100 threshold, so a green tick could sit next to "0K
    // trades". Only abbreviate to "K" once there is enough to round to
    // without losing the number entirely.
    { id: 'sample', label: <InfoTip term="sample_size">Sample Size</InfoTip>, pass: totalTrades >= 100, value: totalTrades >= 1000 ? `${(totalTrades / 1000).toFixed(1)}K trades` : `${totalTrades.toLocaleString()} trades`, detail: totalTrades >= 500 ? 'Far more than the 100 trades we treat as a minimum' : 'Need 100+ trades' },
    { id: 'pf', label: <InfoTip term="profit_factor">Profit Factor</InfoTip>, pass: bestPF >= 1.5, value: bestPF.toFixed(2), detail: bestPF >= 2 ? 'Strong — won more than twice what it lost' : bestPF >= 1.5 ? 'Meets our 1.5 threshold' : 'Below 1.5' },
    { id: 'cycles', label: 'Market Cycles', pass: dateRange.includes('2000'), value: dateRange, detail: 'The test window should reach back to 2000, so it includes the 2008 and 2020 crashes' },
    { id: 'win-rate', label: <InfoTip term="win_rate">Win Rate</InfoTip>, pass: winRate >= 0.45, value: `${bestWR}%`, detail: winRate >= 0.45 ? 'Strong share of trades closed in profit' : 'Below the 45% we look for' },
    { id: 'diversification', label: 'Diversification', pass: tickers >= 20, value: `${tickers} tickers`, detail: tickers >= 50 ? 'Spread across plenty of different stocks' : 'Adequate spread across stocks' },
    wf
      ? { id: 'wf', label: <InfoTip term="walk_forward">Walk-Forward</InfoTip>, pass: wf.good >= Math.ceil(wf.count * 0.7), value: `${wf.good}/${wf.count} strategies pass`, detail: `Scored ${wf.avgOOS.toFixed(2)} on data it had never seen, ${wf.avgDeg.toFixed(1)}% weaker than on the data it was tuned on · ${wf.robust ? 'holds up as market conditions change' : 'fades more than we would like'}` }
      : { id: 'wf', label: <InfoTip term="walk_forward">Walk-Forward</InfoTip>, pass: false, value: 'Not yet run', detail: 'Will check the settings still work when market conditions change' },
  ];
  const passed = checks.filter((c) => c.pass).length;

  return (
    <Card
      title={<InfoTip term="backtest">Backtest Validation</InfoTip>}
      right={<span className="text-[10px] text-[var(--color-text-tertiary)]">Scored in-house — not an outside audit</span>}
    >
      <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        Research Score:{' '}
        {/* FIX: was out of 7 checks; two (Reward-to-Risk and Live Sharpe) were fabricated and have been
            removed above, so the scorecard is now out of 6 — thresholds rescaled to match (~85% / ~50%). */}
        <span data-numeric style={{ color: passed >= 5 ? 'var(--color-bull)' : passed >= 3 ? 'var(--color-caution)' : 'var(--color-bear)' }}>
          {passed}/6 Passed
        </span>
      </p>
      <p className="mb-3 text-xs leading-relaxed text-[var(--color-text-tertiary)]">
        Six checks that help tell a strategy with a genuine advantage from one that only looks good in hindsight. The
        criteria come from published work on backtest validation by López de Prado and Aronson; we score ourselves
        against them, each check counts the same, and no outside party audits the result.
      </p>
      <div className="space-y-1.5">
        {checks.map((c) => (
          <div
            key={c.id}
            className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: 'var(--color-bg-elevated)' }}
          >
            <span aria-hidden="true">{c.pass ? '✅' : '⚠️'}</span>
            <span className="min-w-[180px] font-semibold text-[var(--color-text-primary)]">{c.label}</span>
            <span className="min-w-[90px] text-[var(--color-text-secondary)]" data-numeric>{c.value}</span>
            <span className="flex-1 text-[var(--color-text-tertiary)]">{c.detail}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export function PredictionsClient() {
  const q = useGatedFile('engine', 'prediction-engine.json');

  const header = (
    <div
      className="relative overflow-hidden rounded-[var(--radius-tile)] border p-6"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <span aria-hidden="true" className="glow-orb -top-24 -right-8" />
      <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
        Engine <em className="italic" style={{ color: 'var(--color-accent)' }}>Tuning</em>
      </h1>
      <p className="relative z-10 mt-2 text-sm text-[var(--color-text-secondary)]">
        Every version of the model, replayed against years of past prices and compared side by side — plus how the
        version running today is doing against what those tests said to expect. All trades are simulated.
      </p>
    </div>
  );

  if (q.isLoading) {
    return (
      <div className="space-y-4">
        {header}
        <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">Loading engine data…</p>
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="space-y-4">
        {header}
        <GateCard
          kind={q.error instanceof GateError ? q.error.kind : 'unavailable'}
          need={q.error instanceof GateError ? (q.error.need ?? 'pro') : 'pro'}
          feature="Model tuning results"
        />
      </div>
    );
  }

  const data = q.data;
  const s = data.summary || {};
  const allVersions = Object.entries(data.versions || {}).filter(([, v]: [string, Any]) => v.tag) as [string, Any][];
  const latest10 = allVersions.slice(-10).reverse();
  const milestoneNums = new Set([1, 2, 3, 5, 6, 10, 18, 23]);
  const milestones = allVersions.filter(([name]) => milestoneNums.has(parseInt(name.split(' ')[0].replace('V', ''))));
  const ev = data.evolution;

  return (
    <div className="space-y-4">
      {header}

      <div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <Metric label={<InfoTip term="backtest">Backtest Trades</InfoTip>} value={s.total_backtest_trades?.toLocaleString?.() ?? '—'} sub="simulated, all versions" />
          <Metric label="Tickers" value={s.tickers_tested ?? '—'} sub="symbols tested" />
          <Metric label="Date Range" value={<span className="text-sm">{s.date_range ?? '—'}</span>} />
          <Metric label={<InfoTip term="win_rate">Best Win Rate</InfoTip>} value={s.best_win_rate ?? '—'} sub="best version on this metric" />
          <Metric label={<InfoTip term="avg_pnl">Best Avg Return</InfoTip>} value={s.best_avg_pnl ?? '—'} sub="per trade, best on this metric" color="var(--color-bull)" />
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]">
          Each &ldquo;best&rdquo; figure is the highest any single version reached on that metric — they are not
          necessarily all the same version.
        </p>
      </div>

      {data.live_trading && <LiveTrading lt={data.live_trading} />}

      <EnhancedAccuracy />

      <VersionTable title="Version Comparison" rows={latest10} />
      {milestones.length > 0 && <VersionTable title="Milestone Versions" rows={milestones} />}

      {ev?.mr_progression?.length > 0 && (
        <Card title={<InfoTip term="mean_reversion">Mean-Reversion Evolution</InfoTip>}>
          <div className="space-y-2">
            {ev.mr_progression.slice(-6).map((v: Any) => (
              <div key={v.version} className="flex items-center gap-3 text-sm">
                <span className="min-w-[48px] font-semibold text-[var(--color-text-primary)]" data-numeric>{v.version}</span>
                <WrBadge wr={v.win_rate} />
                <span className="min-w-[64px] text-right" data-numeric style={{ color: pnlColor(v.avg_pnl) }}>{signed(v.avg_pnl)}</span>
                <span className="min-w-[40px] text-right text-[var(--color-text-secondary)]" data-numeric>{v.pf}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(v.win_rate * 1.2, 100)}%`,
                      backgroundColor: v.win_rate >= 70 ? 'var(--color-bull)' : 'var(--color-accent)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t pt-2 text-[10px] leading-relaxed text-[var(--color-text-tertiary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>
            Each row, left to right: the version, the share of its trades that made money, its average return per trade,
            and its profit factor — total gains divided by total losses.
          </p>
        </Card>
      )}

      {(ev?.key_innovations || ev?.what_didnt_work) && (
        <Card title="Iteration Insights">
          {!!ev.key_innovations?.length && (
            <>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-bull)' }}>What worked</p>
              {ev.key_innovations.map((k: string, i: number) => (
                <p key={i} className="py-0.5 text-sm text-[var(--color-text-secondary)]">{k}</p>
              ))}
            </>
          )}
          {!!ev.what_didnt_work?.length && (
            <>
              <p className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-bear)' }}>What did not</p>
              {ev.what_didnt_work.map((k: string, i: number) => (
                <p key={i} className="py-0.5 text-sm text-[var(--color-text-secondary)]">{k}</p>
              ))}
            </>
          )}
        </Card>
      )}

      <Validation data={data} />

      <Card>
        <p className="text-xs leading-relaxed text-[var(--color-text-tertiary)]">
          <strong className="text-[var(--color-text-secondary)]">How this was tested:</strong>{' '}
          Each version was replayed over {s.date_range || 'N/A'} of past prices across {s.tickers_tested || 'N/A'}{' '}
          symbols, on a fixed 21-day hold. That rule governs the version-by-version backtest figures on this page; the
          live paper-trading and live simulation cards, and the walk-forward check, come from separate runs and are not
          bound by it.{' '}
          {data.versions ? Object.keys(data.versions).length : 'N/A'} versions tested,{' '}
          {s.total_backtest_trades?.toLocaleString?.() ?? 'N/A'} simulated trades in total. Council of models: Gemini,
          DeepSeek, MiMo, Nemotron.
        </p>
      </Card>
    </div>
  );
}
