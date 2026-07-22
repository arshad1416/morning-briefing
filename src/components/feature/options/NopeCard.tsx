'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { nopeDetailQuery } from '@/lib/query/options';
import { formatCompact } from '@/lib/format';
import { GateError } from '@/lib/api/gated';
import { GateCard } from '@/components/feature/gating/GateCard';

function metric(value: number | null | undefined, digits = 3) {
  return value == null ? '—' : value.toFixed(digits);
}

export function NopeCard() {
  const { data, isLoading, isError, error } = useQuery(nopeDetailQuery());
  const spy = data?.symbols.SPY;
  const qqq = data?.symbols.QQQ;
  const symbols = [
    { symbol: 'SPY', value: spy },
    { symbol: 'QQQ', value: qqq },
  ];

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden h-full">
      <div className="px-4 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">NOPE Flow Estimate</h3>
        <span className="text-[10px] font-medium text-[var(--color-text-tertiary)]">PRO · EOD</span>
      </div>
      <div className="p-4">
        {/* Without this branch a failed/missing R2 file left an infinite skeleton. */}
        {isError ? (
          error instanceof GateError && error.kind !== 'unavailable' ? (
            <GateCard kind={error.kind} need={error.need ?? 'pro'} feature="NOPE flow" />
          ) : (
            <p className="py-6 text-center text-sm text-[var(--color-text-tertiary)]">
              NOPE data isn&apos;t available right now.
            </p>
          )
        ) : isLoading || !data ? (
          <div className="skeleton h-24" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {symbols.map(({ symbol, value }) => (
                <div key={symbol} className="min-w-0">
                  <p className="text-xs text-[var(--color-text-tertiary)]">{symbol} NOPE</p>
                  <p className="text-xl font-bold mt-0.5 text-[var(--color-text-primary)]" data-numeric>{metric(value?.nope)}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1">
                    Fill {metric(value?.nope_fill)} · {value?.stock_volume ? formatCompact(value.stock_volume) : '—'} shares
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
              {data.methodology} Last calculation: {new Date(data.generated_at).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
