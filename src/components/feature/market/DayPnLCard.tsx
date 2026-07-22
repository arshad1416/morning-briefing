// components/feature/market/DayPnLCard.tsx — portfolio snapshot from the REAL
// paper-trading ledger (paper_trades.json, Basic-gated). The previous version
// rendered a hardcoded demo object ($1,177.72 equity, fake sparkline) to every
// visitor, including subscribers.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Surface, SurfaceHeader, Stat, InfoTip } from '@/components/primitives';
import { fetchGated, GateError } from '@/lib/api/gated';

const PaperPortfolioSchema = z
  .object({
    portfolio: z
      .object({
        total_balance: z.number().default(0),
        starting_balance: z.number().default(100000),
        cash: z.number().default(0),
        invested: z.number().default(0),
        return_pct: z.number().default(0),
        win_rate: z.number().nullable().default(null),
        total_trades: z.number().nullable().default(null),
      })
      .passthrough(),
  })
  .passthrough();

export function DayPnLCard() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['paper-portfolio-tile'],
    queryFn: () => fetchGated('paper_trades.json', PaperPortfolioSchema),
    staleTime: 5 * 60 * 1000,
  });

  const shell = (body: React.ReactNode) => (
    <Surface span="third">
      <SurfaceHeader title="Portfolio" />
      <div className="p-4 space-y-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
          <InfoTip term="paper_trading">Simulated portfolio</InfoTip> — not a recommendation
        </p>
        {body}
      </div>
    </Surface>
  );

  if (isError) {
    const signedOut = error instanceof GateError && error.kind === 'signin';
    return shell(
      <p className="text-sm text-[var(--color-text-tertiary)]">
        {signedOut ? (
          <>
            <a href="/login" className="underline text-[var(--color-accent)]">Sign in</a> to follow the
            $100K practice account — simulated trades, no real money at stake.
          </>
        ) : (
          'Portfolio data isn’t available right now.'
        )}
      </p>,
    );
  }

  if (isLoading || !data) {
    return shell(<div className="skeleton h-24" />);
  }

  const p = data.portfolio;
  const deployedPct = p.total_balance > 0 ? (p.invested / p.total_balance) * 100 : 0;

  return shell(
    <>
      {/* No suffix: the value is already a formatted dollar string, so the old
          suffix="%" rendered "$88,116%" next to the DeltaBadge's own percent.
          The caption below points at "the percentage beside it", which only
          reads unambiguously once there is exactly one. */}
      <Stat label="Account Value" value={`$${p.total_balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} delta={p.return_pct} prefix="" />
      <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
        Cash plus the value of everything held right now — the account’s equity. The percentage beside it
        is the total return since the account opened at $100,000, not today’s move.
      </p>
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-tertiary)]">Invested</span>
        <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
          {deployedPct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, deployedPct)}%`, backgroundColor: 'var(--color-accent)' }} />
      </div>
      <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">
        How much of the account is tied up in open positions, measured at what they cost to buy.
      </p>
      {p.win_rate != null && p.total_trades != null && (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {p.total_trades} closed trades · {p.win_rate.toFixed(0)}%{' '}
          <InfoTip term="win_rate">win rate</InfoTip> since the account opened
        </p>
      )}
    </>,
  );
}
