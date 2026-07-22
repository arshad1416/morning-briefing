'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { nopeDetailQuery } from '@/lib/query/options';
import { formatCompact } from '@/lib/format';

function metric(value: number | null | undefined, digits = 3) {
  return value == null ? '—' : value.toFixed(digits);
}

export function NopeCard() {
  const { data, isLoading } = useQuery(nopeDetailQuery());
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
        {isLoading || !data ? (
          // Mirrors the loaded DOM (2-symbol grid + footnote) so load causes no shift.
          <div aria-busy="true">
            <div className="grid grid-cols-2 gap-4">
              {[0, 1].map((i) => (
                <div key={i}>
                  <div className="skeleton h-4 w-16" />
                  <div className="skeleton h-7 w-20 mt-0.5" />
                  <div className="skeleton h-[15px] w-28 mt-1" />
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <div className="skeleton h-[13px]" />
              <div className="skeleton h-[13px] w-3/4" />
            </div>
          </div>
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
