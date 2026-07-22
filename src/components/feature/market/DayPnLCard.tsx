// components/feature/market/DayPnLCard.tsx — portfolio snapshot from the REAL
// paper-trading ledger (paper_trades.json, Basic-gated). The previous version
// rendered a hardcoded demo object ($1,177.72 equity, fake sparkline) to every
// visitor, including subscribers.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Surface, SurfaceHeader, Stat } from '@/components/primitives';
import { fetchGated, GateError } from '@/lib/api/gated';
import { GateInline } from '@/components/feature/gating/GateInline';

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
          Simulated portfolio — not a recommendation
        </p>
        {body}
      </div>
    </Surface>
  );

  if (isError) {
    // Both gate states get a conversion affordance: the signed-out trial pitch
    // and — previously missing — the signed-in-without-subscription upgrade.
    if (error instanceof GateError && error.kind !== 'unavailable') {
      return shell(
        <GateInline
          kind={error.kind}
          need={error.need ?? 'basic'}
          feature="the live $100K paper-trading portfolio"
        />,
      );
    }
    return shell(
      <p className="text-sm text-[var(--color-text-tertiary)]">Portfolio data isn’t available right now.</p>,
    );
  }

  if (isLoading || !data) {
    return shell(<div className="skeleton h-24" />);
  }

  const p = data.portfolio;
  const deployedPct = p.total_balance > 0 ? (p.invested / p.total_balance) * 100 : 0;

  return shell(
    <>
      <Stat label="Equity" value={`$${p.total_balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} delta={p.return_pct} suffix="%" prefix="" />
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-tertiary)]">Deployed</span>
        <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>
          {deployedPct.toFixed(1)}%
        </span>
      </div>
      <div className="h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, deployedPct)}%`, backgroundColor: 'var(--color-accent)' }} />
      </div>
      {p.win_rate != null && p.total_trades != null && (
        <p className="text-xs text-[var(--color-text-tertiary)]">
          {p.total_trades} trades · {p.win_rate.toFixed(0)}% win rate since inception
        </p>
      )}
    </>,
  );
}
