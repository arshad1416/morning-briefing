// components/feature/options/DealerPositioningCard.tsx
//
// Dealer positioning reconstructed from the option chain (push_gex.py): signed
// dealer gamma (puts negative — true dealer convention, unlike the legacy gross
// GEX), the zero-gamma flip level, max pain, and vanna/charm exposure. All
// computed $0 from the same IBKR/yfinance chains, methodology per public
// dealer-greek math. Simulated/analytical levels — not advice.
'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { gexQuery } from '@/lib/query/options';
import { formatCompact } from '@/lib/format';

function Cell({ label, value, tone, hint }: { label: string; value: string; tone?: 'bull' | 'bear' | 'neutral'; hint?: string }) {
  const color = tone === 'bull' ? 'var(--color-bull)' : tone === 'bear' ? 'var(--color-bear)' : 'var(--color-text-primary)';
  return (
    <div>
      <span className="text-xs text-[var(--color-text-tertiary)]">{label}</span>
      <p className="text-lg font-bold mt-0.5" style={{ fontFamily: 'var(--font-mono)', color }} data-numeric>
        {value}
      </p>
      {hint && <span className="text-[10px] text-[var(--color-text-tertiary)]">{hint}</span>}
    </div>
  );
}

export function DealerPositioningCard() {
  const { data, isLoading } = useQuery(gexQuery());
  const p = data?.positioning;

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden h-full">
      <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">
          Dealer Positioning
        </h3>
      </div>
      <div className="p-4">
        {isLoading || !p ? (
          // Mirrors the loaded DOM (6-cell grid + footnote) so load causes no
          // shift — the old h-24 block was ~100px shorter than the real card.
          <div aria-busy="true">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <div key={i}>
                  <div className="skeleton h-4 w-20" />
                  <div className="skeleton h-7 w-16 mt-0.5" />
                  <div className="skeleton h-[15px] w-24 mt-px" />
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              <div className="skeleton h-[13px]" />
              <div className="skeleton h-[13px]" />
              <div className="skeleton h-[13px] w-2/3" />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Cell
                label="Dealer Gamma"
                value={p.dealer_gamma != null ? formatCompact(p.dealer_gamma) : '—'}
                tone={p.signed_regime === 'long' ? 'bull' : p.signed_regime === 'short' ? 'bear' : 'neutral'}
                hint={p.signed_regime === 'long' ? 'long → range-bound' : p.signed_regime === 'short' ? 'short → trending' : 'neutral'}
              />
              <Cell
                label="Gamma Flip"
                value={p.gamma_flip != null ? `$${p.gamma_flip.toFixed(2)}` : '—'}
                hint={p.gamma_flip != null && p.spot != null ? (p.spot >= p.gamma_flip ? 'spot above → stabilizing' : 'spot below → destabilizing') : undefined}
              />
              <Cell label="Max Pain" value={p.max_pain != null ? `$${p.max_pain.toFixed(0)}` : '—'} />
              <Cell label="Vanna Exp." value={p.vanna != null ? formatCompact(p.vanna) : '—'} hint="Δ per 1% IV" />
              <Cell label="Charm Exp." value={p.charm != null ? formatCompact(p.charm) : '—'} hint="Δ decay / day" />
              <Cell label="Spot" value={p.spot != null ? `$${p.spot.toFixed(2)}` : '—'} />
            </div>
            <p className="mt-3 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
              Signed dealer gamma (puts negative). The flip is the spot where dealer gamma crosses
              zero — above it dealers dampen moves, below it they amplify them. Analytical estimate
              from open interest; not advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
