// app/positions/positions-client.tsx — Trading Performance, ported from the
// legacy paper-trades.js. Three tabs: Paper Trading (paper_trades.json),
// IBKR Paper Account (ibkr_*.json), Journal (journal.json + local entries).
//
// All data here is Basic-tier behind the Worker gate — the legacy route was
// guarded at Basic and the files live in private R2. Visitors get a GateCard;
// the previous version of this page rendered a hardcoded placeholder table.
'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { GateCard } from '@/components/feature/gating/GateCard';
import { fetchGated, GateError } from '@/lib/api/gated';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;
const raw = { parse: (d: unknown) => d as Any };

const useGatedFile = (name: string, file: string) =>
  useQuery<Any>({
    queryKey: ['positions', name],
    queryFn: () => fetchGated<Any>(file, raw),
    staleTime: 120_000,
    retry: false,
  });

/* ------------------------------------------------------------------ */
/*  Atoms                                                             */
/* ------------------------------------------------------------------ */

const fmt = (v: number | null | undefined, d = 2) =>
  v == null ? '—' : Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const pnlColor = (v: number) => (v >= 0 ? 'var(--color-bull)' : 'var(--color-bear)');

function Card({ title, children, className = '' }: { title?: string; children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[var(--radius-tile)] border ${className}`}
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      {title && (
        <div className="border-b px-4 py-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
          <h3 className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">{title}</h3>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">{label}</p>
      <p className="mt-1 text-lg font-bold" data-numeric style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</p>
    </div>
  );
}

function Badge({ tone, children }: { tone: 'bull' | 'bear' | 'caution' | 'muted'; children: React.ReactNode }) {
  const color =
    tone === 'bull' ? 'var(--color-bull)' : tone === 'bear' ? 'var(--color-bear)' : tone === 'caution' ? 'var(--color-caution)' : 'var(--color-text-tertiary)';
  return (
    <span
      className="inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      {children}
    </span>
  );
}

const AC_TONE: Record<string, 'bull' | 'bear' | 'caution' | 'muted'> = {
  OPTION: 'bear',
  CRYPTO: 'caution',
  FOREX: 'bull',
  COMMODITY: 'caution',
  STOCK: 'muted',
};
const AC_LABEL: Record<string, string> = { OPTION: 'OPT', CRYPTO: 'CRYPTO', FOREX: 'FX', COMMODITY: 'COMM', STOCK: 'STOCK' };

const TH = ({ children, align = 'left' }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center' }) => (
  <th className={`px-3 py-2 text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)] text-${align} whitespace-nowrap`}>{children}</th>
);
const TD = ({ children, align = 'left', color, bold }: { children?: React.ReactNode; align?: 'left' | 'right' | 'center'; color?: string; bold?: boolean }) => (
  <td
    className={`border-t px-3 py-2 text-${align} ${bold ? 'font-semibold' : ''} whitespace-nowrap`}
    data-numeric
    style={{ borderColor: 'var(--color-border-subtle)', color: color ?? 'var(--color-text-secondary)' }}
  >
    {children}
  </td>
);

function SimLabel() {
  return (
    <p
      className="rounded-lg border px-3 py-2 text-xs leading-relaxed"
      style={{
        borderColor: 'color-mix(in srgb, var(--color-caution) 30%, transparent)',
        backgroundColor: 'color-mix(in srgb, var(--color-caution) 6%, transparent)',
        color: 'var(--color-text-tertiary)',
      }}
    >
      <strong style={{ color: 'var(--color-caution)' }}>Simulated portfolio — not a recommendation.</strong>{' '}
      Paper-trading results with no real money.
    </p>
  );
}

/* ------------------------------------------------------------------ */
/*  Currency preference (native / USD / CAD)                          */
/* ------------------------------------------------------------------ */

type CurPref = 'native' | 'USD' | 'CAD';

function priceIn(t: Any, field: 'entry_price' | 'current_price' | 'exit_price', pref: CurPref): { val: number | null; cur: string } {
  if (pref === 'USD') return { val: t[`${field}_usd`] ?? t[field] ?? null, cur: 'USD' };
  if (pref === 'CAD') return { val: t[`${field}_cad`] ?? t[field] ?? null, cur: 'CAD' };
  return { val: t[field] ?? null, cur: t.currency || 'USD' };
}

/* ------------------------------------------------------------------ */
/*  Paper Trading tab                                                 */
/* ------------------------------------------------------------------ */

const ASSET_COLORS: Record<string, string> = {
  equity: '#6366f1',
  etf: '#0ea5e9',
  bond: '#10b981',
  commodity: '#f59e0b',
  crypto: '#f7931a',
  forex: '#a855f7',
  option: '#ec4899',
};
const ASSET_LABEL: Record<string, string> = {
  equity: 'Equities', etf: 'ETFs', bond: 'Bonds', commodity: 'Commodities',
  crypto: 'Crypto', forex: 'FX', option: 'Options',
};

function AssetMixCard({ mix }: { mix: Any }) {
  const entries = mix && typeof mix === 'object'
    ? Object.entries(mix as Record<string, { count: number; pct: number }>).sort((a, b) => b[1].pct - a[1].pct)
    : [];
  if (entries.length === 0) return null;
  return (
    <Card title="Asset-Class Mix">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--color-bg-elevated)' }}>
        {entries.map(([cls, v]) => (
          <div key={cls} title={`${ASSET_LABEL[cls] || cls}: ${v.pct}%`} style={{ width: `${v.pct}%`, backgroundColor: ASSET_COLORS[cls] || 'var(--color-text-tertiary)' }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {entries.map(([cls, v]) => (
          <div key={cls} className="flex items-center gap-1.5 text-xs">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: ASSET_COLORS[cls] || 'var(--color-text-tertiary)' }} />
            <span className="text-[var(--color-text-secondary)]">{ASSET_LABEL[cls] || cls}</span>
            <span className="font-semibold text-[var(--color-text-primary)]" data-numeric>{v.pct}%</span>
            <span className="text-[var(--color-text-tertiary)]" data-numeric>({v.count})</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PaperTab({ data }: { data: Any }) {
  const accuracy = useGatedFile('accuracy', 'accuracy.json'); // Pro file — sections render only if entitled
  const [pref, setPref] = useState<CurPref>('native');
  useEffect(() => {
    const saved = localStorage.getItem('mg-preferred-currency') as CurPref | null;
    if (saved === 'USD' || saved === 'CAD' || saved === 'native') setPref(saved);
  }, []);
  const cyclePref = () => {
    const next: CurPref = pref === 'native' ? 'USD' : pref === 'USD' ? 'CAD' : 'native';
    setPref(next);
    localStorage.setItem('mg-preferred-currency', next);
  };

  const p = data?.portfolio;
  const open: Any[] = data?.open_positions ?? [];
  const isOption = (t: Any) =>
    (t.asset_class || '').toUpperCase() === 'OPTION' || (t.type || '').toLowerCase() === 'option' || (t.trade_type || '').toLowerCase() === 'option';
  const stockPositions = open.filter((t) => !isOption(t));
  const optionPositions = open.filter(isOption);
  const trades: Any[] = data?.recent_trades ?? [];
  const acc = accuracy.data;

  if (!p) return <p className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">No paper-trading data available yet.</p>;

  const equity = (p.starting_balance || 0) + (p.total_pnl || 0) + (p.unrealized_pnl || 0);
  const deployed = p.invested || 0;
  const totalPnl = p.total_pnl || 0;
  const fx = data.fx_rate_usdcad || 1.38;

  const status = (pct: number) =>
    pct > 5 ? '✅ In Profit' : pct > 2 ? '✅ Profitable' : pct > 0 ? '⏳ Pending' : pct > -3 ? '⏳ Watching' : pct > -7 ? '⚠️ At Risk' : '🔴 Stop Zone';

  return (
    <div className="space-y-4">
      <SimLabel />

      {/* Hero P&L */}
      <Card>
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--color-text-tertiary)]">Total P&L</span>
          <span className="text-3xl font-bold" data-numeric style={{ color: pnlColor(totalPnl) }}>
            {totalPnl >= 0 ? '+' : '−'}${fmt(Math.abs(totalPnl))}
          </span>
          <span className="text-sm font-medium" data-numeric style={{ color: pnlColor(totalPnl) }}>
            ({(p.return_pct || 0) >= 0 ? '+' : ''}{fmt(p.return_pct)}%)
          </span>
          <span className="ml-auto text-xs text-[var(--color-text-tertiary)]" data-numeric>
            Equity ${fmt(equity)} · Cash ${fmt(p.cash)} · {deployed > 0 ? `${Math.round((deployed / equity) * 100)}% deployed` : 'all cash'}
          </span>
        </div>
      </Card>

      {/* Detail grid */}
      <Card>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Metric label="Status" value={data.status || '—'} color="var(--color-bull)" />
          <Metric label="Starting" value={`$${fmt(p.starting_balance)}`} />
          <Metric label="Cash" value={`$${fmt(p.cash)}`} />
          <Metric label="Invested" value={`$${fmt(p.invested || 0)}`} />
          <Metric label="Total Value" value={`$${fmt(p.total_balance)}`} />
          <Metric label="Win Rate" value={`${p.win_rate || 0}%`} color={(p.win_rate || 0) >= 50 ? 'var(--color-bull)' : 'var(--color-bear)'} />
          <Metric label="Trades" value={p.total_trades} />
          <Metric
            label="Unrealized"
            value={`${(p.unrealized_pnl || 0) >= 0 ? '+' : '−'}$${fmt(Math.abs(p.unrealized_pnl || 0))}`}
            color={pnlColor(p.unrealized_pnl || 0)}
          />
          <Metric label="Active Strategy" value={<span className="text-sm">{data.active_strategy || '—'}</span>} />
          <Metric
            label="Last Updated"
            value={
              <span className="text-xs">
                {data.generated_at
                  ? `${new Date(data.generated_at).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' })} ET`
                  : '—'}
              </span>
            }
          />
        </div>
      </Card>

      {/* Asset-class mix — demonstrates true multi-asset coverage */}
      <AssetMixCard mix={data.asset_class_mix} />

      {/* Open positions */}
      <Card
        title={`Open Positions (${stockPositions.length})`}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-text-tertiary)]">
          <span data-numeric>
            {Object.entries(
              open.reduce((acc: Record<string, number>, t: Any) => {
                const ac = (t.asset_class || 'STOCK').toUpperCase();
                acc[ac] = (acc[ac] || 0) + 1;
                return acc;
              }, {}),
            )
              .map(([k, v]) => `${v} ${k}`)
              .join(' · ') || 'No open positions'}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={cyclePref}
              className="rounded-lg border px-2.5 py-1 text-xs font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-bg-elevated)] hover:text-[var(--color-text-primary)]"
              style={{ borderColor: 'var(--color-border-default)' }}
            >
              {pref === 'native' ? 'Native Currency' : pref}
            </button>
            <span data-numeric>FX: 1 USD = {fx.toFixed(2)} CAD</span>
          </span>
        </div>
        {stockPositions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr>
                  <TH>Ticker</TH><TH>Asset</TH><TH>Type</TH><TH>Entry</TH><TH align="right">Entry Price</TH><TH align="right">Current</TH><TH align="right">P&L</TH><TH>Strategy</TH><TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {stockPositions.map((t, i) => {
                  const ac = (t.asset_class || 'STOCK').toUpperCase();
                  const entry = priceIn(t, 'entry_price', pref);
                  const curr = priceIn(t, 'current_price', pref);
                  const pct = t.pnl_pct || 0;
                  return (
                    <tr key={i} title={t.rationale ? `Decision: ${t.rationale}` : undefined}>
                      <TD bold color="var(--color-text-primary)">{t.ticker}</TD>
                      <TD><Badge tone={AC_TONE[ac] ?? 'muted'}>{AC_LABEL[ac] ?? ac}</Badge></TD>
                      <TD>{t.type || 'Other'}</TD>
                      <TD>{t.entry_date || '—'}</TD>
                      <TD align="right">${fmt(entry.val)} {entry.cur}</TD>
                      <TD align="right">${fmt(curr.val)} {curr.cur}</TD>
                      <TD align="right" bold color={pnlColor(pct)}>
                        ${fmt(t.pnl)} ({pct >= 0 ? '+' : ''}{fmt(pct, 1)}%)
                      </TD>
                      <TD>{t.strategy || '—'}</TD>
                      <TD><Badge tone={pct > 0 ? 'bull' : pct < -3 ? 'bear' : 'caution'}>{status(pct)}</Badge></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">No open positions. All trades closed.</p>
        )}
      </Card>

      {/* Option positions */}
      {optionPositions.length > 0 && (
        <Card title="My Option Positions">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr>
                  <TH>Ticker</TH><TH align="right">Strike</TH><TH>Expiry</TH><TH align="right">DTE</TH><TH align="right">Premium Paid</TH><TH align="right">Current Premium</TH><TH align="right">P&L</TH><TH>Status</TH>
                </tr>
              </thead>
              <tbody>
                {optionPositions.map((pos, i) => {
                  const dte = pos.option_days_to_expiry;
                  const pnl = pos.pnl || 0;
                  return (
                    <tr key={i}>
                      <TD bold color="var(--color-text-primary)">{pos.ticker}</TD>
                      <TD align="right">{pos.option_strike != null ? `$${pos.option_strike}` : '—'}</TD>
                      <TD>{pos.option_expiration || '—'}</TD>
                      <TD align="right" color={dte != null && dte <= 3 ? 'var(--color-bear)' : undefined} bold={dte != null && dte <= 3}>
                        {dte != null ? `${dte}d` : '—'}
                      </TD>
                      <TD align="right">{pos.entry_price != null ? `$${fmt(pos.entry_price)}` : '—'}</TD>
                      <TD align="right">{pos.current_price != null ? `$${fmt(pos.current_price)}` : '—'}</TD>
                      <TD align="right" bold color={pnlColor(pnl)}>{pnl >= 0 ? '+' : '−'}${fmt(Math.abs(pnl))}</TD>
                      <TD>{dte == null ? '⏳ Open' : dte <= 0 ? '🔴 Expired' : dte <= 3 ? '⚠️ Expiring Soon' : '⏳ Open'}</TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Accuracy summary (Pro data — renders only when the gate lets it through) */}
      {acc?.overall && (
        <Card title="Prediction Engine Accuracy">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Top 10 Avg WR" value={`${acc.overall.top_10_avg_win_rate}%`} color="var(--color-bull)" />
            <Metric label="Top 10 Avg P&L" value={`+${acc.overall.top_10_avg_pnl}%`} color="var(--color-bull)" />
            <Metric label="Best Win Rate" value={`${acc.overall.best_win_rate}%`} color="var(--color-bull)" />
            <Metric label="Total Backtest" value={acc.overall.total_backtest_trades?.toLocaleString?.() ?? '—'} />
          </div>
        </Card>
      )}
      {!!acc?.top_performers?.length && (
        <Card title="Best Strategies (Backtest Verified)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr><TH>Rank</TH><TH>Version</TH><TH align="right">Trades</TH><TH align="center">Win Rate</TH><TH align="right">Avg P&L</TH><TH align="right">PF</TH><TH align="center">Confidence</TH></tr>
              </thead>
              <tbody>
                {acc.top_performers.slice(0, 10).map((v: Any, i: number) => {
                  const conf = v.trades >= 100 ? 'High' : v.trades >= 30 ? 'Medium' : 'Low';
                  return (
                    <tr key={i}>
                      <TD>{['🥇', '🥈', '🥉'][i] ?? i + 1}</TD>
                      <TD bold color="var(--color-text-primary)">{v.name ?? v.version}</TD>
                      <TD align="right">{v.trades}</TD>
                      <TD align="center"><Badge tone={v.win_rate >= 70 ? 'bull' : v.win_rate >= 60 ? 'caution' : 'muted'}>{v.win_rate}%</Badge></TD>
                      <TD align="right" color={pnlColor(v.avg_pnl ?? 0)}>{(v.avg_pnl ?? 0) >= 0 ? '+' : ''}{v.avg_pnl}%</TD>
                      <TD align="right">{v.profit_factor}</TD>
                      <TD align="center"><Badge tone={conf === 'High' ? 'bull' : conf === 'Medium' ? 'caution' : 'bear'}>{conf}</Badge></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Trade history */}
      {trades.length > 0 && (
        <Card title="Trade History">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr><TH>Ticker</TH><TH>Type</TH><TH>Entry</TH><TH>Exit</TH><TH align="right">Entry Price</TH><TH align="right">Exit Price</TH><TH align="right">P&L</TH><TH>Status</TH></tr>
              </thead>
              <tbody>
                {trades.slice(0, 30).map((t, i) => {
                  const entry = priceIn(t, 'entry_price', pref);
                  const exit = priceIn(t, 'exit_price', pref);
                  const pct = t.pnl_pct;
                  const cls = (pct ?? t.pnl_usd ?? 0) >= 0;
                  const d = (s?: string) => {
                    if (!s) return '—';
                    try {
                      return new Date(s.replace('Z', '').replace('T', ' ')).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
                    } catch {
                      return s.slice(0, 10);
                    }
                  };
                  return (
                    <tr key={i} title={[t.reason || t.rationale ? `Entry: ${t.reason || t.rationale}` : '', t.exit_rationale ? `Exit: ${t.exit_rationale}` : ''].filter(Boolean).join(' | ') || undefined}>
                      <TD bold color="var(--color-text-primary)">{t.ticker}</TD>
                      <TD><Badge tone={t.type === 'Stock' ? 'bull' : 'caution'}>{t.type || '—'}</Badge></TD>
                      <TD>{d(t.entry_date)}</TD>
                      <TD>{d(t.exit_date)}</TD>
                      <TD align="right">{entry.val != null ? `$${fmt(entry.val)} ${entry.cur}` : '—'}</TD>
                      <TD align="right">{exit.val != null ? `$${fmt(exit.val)} ${exit.cur}` : '—'}</TD>
                      <TD align="right" bold color={cls ? 'var(--color-bull)' : 'var(--color-bear)'}>
                        {pct != null ? `${pct >= 0 ? '+' : ''}${pct}%` : t.pnl_usd != null ? `$${fmt(t.pnl_usd)}` : '—'}
                      </TD>
                      <TD><Badge tone="bull">Closed</Badge></TD>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  IBKR Paper Account tab                                            */
/* ------------------------------------------------------------------ */

function IbkrTab() {
  const account = useGatedFile('ibkr-account', 'ibkr_account.json');
  const positions = useGatedFile('ibkr-positions', 'ibkr_positions.json');
  const trades = useGatedFile('ibkr-trades', 'ibkr_trades.json');

  if (account.isLoading || positions.isLoading || trades.isLoading)
    return <p className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">Loading paper account…</p>;

  if (!account.data && !positions.data && !trades.data)
    return (
      <p className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">
        No account data available yet — the portfolio agent runs daily at 07:12 ET.
      </p>
    );

  // The agent writes enveloped files: {timestamp, version, data: [...]}.
  // The old accessors read keys that never existed, so real positions
  // rendered as em-dashes and "No open positions."
  const acct = account.data?.data?.[0] ?? {};
  const s = { ...(acct.summary ?? {}), currency: acct.currency };
  const pos: Any[] = positions.data?.data ?? [];
  const tr: Any[] = (trades.data?.data ?? []).slice(-10).reverse();

  return (
    <div className="space-y-4">
      <SimLabel />
      <Card title={`Account Summary (${s.currency || 'USD'})`}>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <Metric label="Net Liquidation" value={s.net_liquidation != null ? `$${fmt(s.net_liquidation)}` : '—'} />
          <Metric label="Buying Power" value={s.buying_power != null ? `$${fmt(s.buying_power)}` : '—'} />
          <Metric label="Cash Balance" value={s.cash_balance != null ? `$${fmt(s.cash_balance)}` : '—'} />
          <Metric
            label="Unrealized P&L"
            value={s.unrealized_pnl != null ? `${s.unrealized_pnl >= 0 ? '+' : '−'}$${fmt(Math.abs(s.unrealized_pnl))}` : '—'}
            color={s.unrealized_pnl != null ? pnlColor(s.unrealized_pnl) : undefined}
          />
          <Metric
            label="Realized P&L"
            value={s.realized_pnl != null ? `${s.realized_pnl >= 0 ? '+' : '−'}$${fmt(Math.abs(s.realized_pnl))}` : '—'}
            color={s.realized_pnl != null ? pnlColor(s.realized_pnl) : undefined}
          />
        </div>
      </Card>

      <Card title={`Open Positions (${pos.length})`}>
        {pos.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead>
                <tr><TH>Ticker</TH><TH align="right">Qty</TH><TH align="right">Market Price</TH><TH align="right">Market Value</TH><TH align="right">Unrealized P&L</TH><TH align="right">Cost Basis</TH><TH>Currency</TH></tr>
              </thead>
              <tbody>
                {pos.map((pp, i) => (
                  <tr key={i}>
                    <TD bold color="var(--color-text-primary)">{pp.ticker}</TD>
                    <TD align="right">{pp.quantity ?? '—'}</TD>
                    <TD align="right">{pp.market_price != null ? `$${fmt(pp.market_price)}` : '—'}</TD>
                    <TD align="right">{pp.market_value != null ? `$${fmt(pp.market_value)}` : '—'}</TD>
                    <TD align="right" bold color={pnlColor(pp.unrealized_pnl || 0)}>
                      {pp.unrealized_pnl != null ? `${pp.unrealized_pnl >= 0 ? '+' : '−'}$${fmt(Math.abs(pp.unrealized_pnl))}` : '—'}
                    </TD>
                    <TD align="right">{pp.cost_basis != null ? `$${fmt(pp.cost_basis)}` : '—'}</TD>
                    <TD>{pp.currency || '—'}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">No open positions.</p>
        )}
      </Card>

      {tr.length > 0 && (
        <Card title={`Recent Trades (Last ${tr.length})`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr><TH>Ticker</TH><TH>Direction</TH><TH align="right">Qty</TH><TH align="right">Price</TH><TH>Date</TH><TH align="right">P&L</TH></tr>
              </thead>
              <tbody>
                {tr.map((t, i) => (
                  <tr key={i}>
                    <TD bold color="var(--color-text-primary)">{t.ticker}</TD>
                    <TD><Badge tone={t.direction === 'BUY' ? 'bull' : 'bear'}>{t.direction}</Badge></TD>
                    <TD align="right">{t.quantity ?? '—'}</TD>
                    <TD align="right">{t.price != null ? `$${fmt(t.price)}` : '—'}</TD>
                    <TD>{t.trade_date || '—'}</TD>
                    <TD align="right" color={pnlColor(t.pnl || 0)}>
                      {t.pnl != null ? `${t.pnl >= 0 ? '+' : '−'}$${fmt(Math.abs(t.pnl))}` : '—'}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Journal tab (file entries + locally-saved ones)                   */
/* ------------------------------------------------------------------ */

const GRADES = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'];
const EMOTIONS = ['Confident', 'Calm', 'Neutral', 'Hopeful', 'Anxiety', 'FOMO', 'Greed', 'Fear', 'Regret'];
const GRADE_POINTS: Record<string, number> = { A: 4, 'A-': 3.7, 'B+': 3.3, B: 3, 'B-': 2.7, 'C+': 2.3, C: 2, 'C-': 1.7, D: 1, F: 0 };
const LOCAL_KEY = 'mg-journal-entries';

function JournalTab() {
  // journal.json has no producer in the pipeline — the gated fetch 404'd on
  // every visit. The journal is device-local (localStorage) by design.
  const [localEntries, setLocalEntries] = useState<Any[]>([]);
  const [form, setForm] = useState({ ticker: '', grade: 'B', emotion: 'Neutral', strategy: '', lesson: '', mistake: '' });

  useEffect(() => {
    try {
      setLocalEntries(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]'));
    } catch {}
  }, []);

  const entries: Any[] = [...localEntries];
  const sorted = [...entries].reverse();

  const submit = () => {
    if (!form.ticker.trim() && !form.lesson.trim()) return;
    const entry = { ...form, ticker: form.ticker.toUpperCase(), date: new Date().toISOString().slice(0, 10), _local: true };
    const next = [...localEntries, entry];
    setLocalEntries(next);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
    setForm({ ticker: '', grade: 'B', emotion: 'Neutral', strategy: '', lesson: '', mistake: '' });
  };

  const avgGrade = entries.length
    ? entries.reduce((s, e) => s + (GRADE_POINTS[e.grade || 'B'] ?? 0), 0) / entries.length
    : 0;
  const topEmotion = entries.length
    ? Object.entries(
        entries.reduce((acc: Record<string, number>, e) => {
          const em = e.emotion || 'Neutral';
          acc[em] = (acc[em] || 0) + 1;
          return acc;
        }, {}),
      ).sort((a, b) => b[1] - a[1])[0][0]
    : '—';

  const inputCls =
    'w-full rounded-lg border bg-[var(--color-bg-elevated)] px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]';
  const inputStyle = { borderColor: 'var(--color-border-subtle)' } as const;

  return (
    <div className="space-y-4">
      {entries.length > 0 && (
        <Card>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Metric label="Entries" value={entries.length} />
            <Metric
              label="Avg Grade"
              value={`${avgGrade.toFixed(1)} (${entries.filter((e) => (e.grade || 'B')[0] === 'A').length} As)`}
              color={avgGrade >= 3 ? 'var(--color-bull)' : avgGrade >= 2 ? 'var(--color-caution)' : 'var(--color-bear)'}
            />
            <Metric label="Top Emotion" value={topEmotion} />
            <Metric label="Lessons" value={entries.filter((e) => e.lesson).length} />
          </div>
        </Card>
      )}

      <Card title="New Journal Entry">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <input value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} placeholder="Ticker" className={inputCls} style={inputStyle} data-numeric />
          <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })} className={inputCls} style={inputStyle}>
            {GRADES.map((g) => (
              <option key={g} value={g}>Grade: {g}</option>
            ))}
          </select>
          <select value={form.emotion} onChange={(e) => setForm({ ...form, emotion: e.target.value })} className={inputCls} style={inputStyle}>
            {EMOTIONS.map((em) => (
              <option key={em} value={em}>{em}</option>
            ))}
          </select>
          <input value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })} placeholder="Strategy (e.g. mean_reversion)" className={inputCls} style={inputStyle} />
        </div>
        <textarea value={form.lesson} onChange={(e) => setForm({ ...form, lesson: e.target.value })} placeholder="Key lesson learned…" rows={2} className={`${inputCls} mt-2.5 resize-y`} style={inputStyle} />
        <textarea value={form.mistake} onChange={(e) => setForm({ ...form, mistake: e.target.value })} placeholder="Mistake made (if any)…" rows={2} className={`${inputCls} mt-2.5 resize-y`} style={inputStyle} />
        <button
          type="button"
          onClick={submit}
          className="mt-3 rounded-lg px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--color-accent-fg)]"
          style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
        >
          Submit Entry
        </button>
        <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">Entries you add here are stored in this browser.</p>
      </Card>

      {sorted.length > 0 ? (
        <Card title="Entries">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr><TH>Date</TH><TH>Ticker</TH><TH align="center">Grade</TH><TH>Emotion</TH><TH>Strategy</TH><TH>Lesson</TH><TH>Mistake</TH></tr>
              </thead>
              <tbody>
                {sorted.map((e, i) => (
                  <tr key={i}>
                    <TD>{e.date || e.trade_id || '—'}</TD>
                    <TD bold color="var(--color-text-primary)">{e.ticker || '—'}</TD>
                    <TD align="center">
                      <Badge tone={(e.grade || 'B')[0] === 'A' ? 'bull' : (e.grade || 'B')[0] === 'B' ? 'caution' : 'bear'}>{e.grade || 'B'}</Badge>
                    </TD>
                    <TD>{e.emotion || '—'}</TD>
                    <TD>{e.strategy || '—'}</TD>
                    <td className="border-t px-3 py-2 text-xs text-[var(--color-text-secondary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>{e.lesson || '—'}</td>
                    <td className="border-t px-3 py-2 text-xs text-[var(--color-text-tertiary)]" style={{ borderColor: 'var(--color-border-subtle)' }}>{e.mistake || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <p className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">No journal entries yet.</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const TABS = [
  { key: 'paper', label: 'Paper Trading' },
  { key: 'ibkr', label: 'IBKR Paper Account' },
  { key: 'journal', label: 'Journal' },
] as const;

export function PositionsClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('paper');
  const paper = useGatedFile('paper-trades', 'paper_trades.json');

  const header = (
    <div
      className="relative overflow-hidden rounded-[var(--radius-tile)] border p-6"
      style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
    >
      <span aria-hidden="true" className="glow-orb -top-24 -right-8" />
      <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
        Trading <em className="italic" style={{ color: 'var(--color-accent)' }}>Performance</em>
      </h1>
      <p className="relative z-10 mt-2 text-sm text-[var(--color-text-secondary)]">
        The simulated book, the IBKR paper account, and the trade journal — full transparency.
      </p>
    </div>
  );

  // The whole page is Basic tier (legacy guarded the route): visitors see the gate.
  if (paper.error) {
    return (
      <div className="space-y-4">
        {header}
        <GateCard
          kind={paper.error instanceof GateError ? paper.error.kind : 'unavailable'}
          need={paper.error instanceof GateError ? (paper.error.need ?? 'basic') : 'basic'}
          feature="Trading performance"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      <div className="overflow-x-auto">
        <div
          className="flex min-w-max gap-1 rounded-full border p-1"
          style={{ borderColor: 'var(--color-border-subtle)', backgroundColor: 'var(--color-bg-surface)' }}
          role="tablist"
          aria-label="Trading performance sections"
        >
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className="whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition"
              style={
                tab === t.key
                  ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }
                  : { color: 'var(--color-text-secondary)' }
              }
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'paper' &&
        (paper.isLoading ? (
          <p className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">Loading trade data…</p>
        ) : (
          <PaperTab data={paper.data} />
        ))}
      {tab === 'ibkr' && <IbkrTab />}
      {tab === 'journal' && <JournalTab />}
    </div>
  );
}
