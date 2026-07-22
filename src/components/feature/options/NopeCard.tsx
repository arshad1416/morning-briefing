'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { nopeDetailQuery } from '@/lib/query/options';
import { InfoTip, PlainLabel } from '@/components/primitives';
import { formatCompact } from '@/lib/format';

function metric(value: number | null | undefined, digits = 3) {
  return value == null ? '—' : value.toFixed(digits);
}

export function NopeCard() {
  // NOT A BUG (checked against the producer): data.symbols is typed as a
  // z.record, so the schema alone would permit any key, but
  // pi-scripts/nope_calculator.py only ever writes SPY and QQQ — both
  // calculate_and_publish_nope() and calculate_and_log_daily_nope() default to
  // symbols=("SPY", "QQQ"), and every call site in the file (incl. __main__)
  // passes exactly ["SPY", "QQQ"]. There is no other caller anywhere in
  // pi-scripts/. The card's fixed two-symbol layout matches the sole real
  // producer's fixed contract, so nothing is ever silently dropped today.
  const { data, isLoading } = useQuery(nopeDetailQuery());
  const spy = data?.symbols.SPY;
  const qqq = data?.symbols.QQQ;
  const symbols = [
    { symbol: 'SPY', value: spy },
    { symbol: 'QQQ', value: qqq },
  ];

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden h-full">
      {/* "Flow" dropped from the title: the card's own methodology line says this
          is explicitly not order flow. "EOD" spelled out. */}
      <div className="px-4 py-3 border-b flex items-start justify-between gap-3" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <div className="min-w-0">
          <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">
            <InfoTip term="nope">NOPE Estimate</InfoTip>
          </h3>
          <PlainLabel term="nope" className="mt-0.5" />
        </div>
        {/* Stacked rather than "PRO · END OF DAY" on one nowrap line: spelling
            EOD out made the badge ~40% wider, and since it cannot shrink, the
            title block absorbed the whole squeeze in a half-width tile. Two
            short lines are as wide as the old "PRO · EOD" and still plain. */}
        <span className="shrink-0 text-right leading-tight text-[10px] font-medium text-[var(--color-text-tertiary)]">
          PRO
          <span className="block whitespace-nowrap">End of day</span>
        </span>
      </div>
      <div className="p-4">
        {isLoading || !data ? (
          <div className="skeleton h-24" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
              {symbols.map(({ symbol, value }) => (
                <div key={symbol} className="min-w-0">
                  <p className="text-xs text-[var(--color-text-tertiary)]">{symbol} NOPE</p>
                  <p className="text-xl font-bold mt-0.5 text-[var(--color-text-primary)]" data-numeric>{metric(value?.nope)}</p>
                  <p className="text-[10px] text-[var(--color-text-tertiary)] mt-1 leading-snug">
                    Fill-adjusted {metric(value?.nope_fill)} · {value?.stock_volume ? formatCompact(value.stock_volume) : '—'} shares traded
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
              The usual reading is that a figure near zero suggests ordinary share trading is
              setting the price, and that the further it sits from zero in either direction, the
              more the options market may be doing the steering. That interpretation is a
              convention among traders rather than an established result, so treat it as one input.
              The fill-adjusted figure reruns the calculation after weighting each side of the
              chain by an assumed buy/sell split, so it rests on one more layer of estimation than
              the number above it.
            </p>
            <p className="mt-2 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
              {data.methodology} Last calculation: {new Date(data.generated_at).toLocaleString()}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
