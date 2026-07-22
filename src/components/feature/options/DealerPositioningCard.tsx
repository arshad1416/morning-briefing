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
import { InfoTip } from '@/components/primitives';
import { formatCompact } from '@/lib/format';
import type { GlossaryTerm } from '@/lib/glossary';

// No <PlainLabel> in these cells. The captions are one to three lines depending
// on column width, and because grid items size independently that pushed the
// numbers in a row off a shared baseline (worst in the 2-column mobile layout,
// where "Are dealers cushioning or chasing?" wraps to three lines next to a
// one-line neighbour). Every label keeps its real term plus an <InfoTip>, and
// the always-visible plain-English explanation moved to `hint` below the number,
// where a longer or shorter line cannot knock the figures out of alignment.
function Cell({
  label,
  term,
  value,
  tone,
  hint,
}: {
  label: string;
  /** Glossary term for the tooltip. */
  term: GlossaryTerm;
  value: string;
  tone?: 'bull' | 'bear' | 'neutral';
  /** Always-on plain-English gloss, rendered under the number. */
  hint?: string;
}) {
  const color = tone === 'bull' ? 'var(--color-bull)' : tone === 'bear' ? 'var(--color-bear)' : 'var(--color-text-primary)';
  return (
    <div>
      <span className="block text-xs text-[var(--color-text-tertiary)]">
        <InfoTip term={term}>{label}</InfoTip>
      </span>
      <p className="text-lg font-bold mt-0.5" style={{ fontFamily: 'var(--font-mono)', color }} data-numeric>
        {value}
      </p>
      {hint && <span className="text-[10px] text-[var(--color-text-tertiary)] leading-snug">{hint}</span>}
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
        <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-tertiary)] normal-case tracking-normal">
          &ldquo;Dealers&rdquo; here are the market makers who sold most of these options — not your
          broker. To stay balanced they have to keep buying and selling the underlying shares, and
          that hedging can either calm the market down or make its moves bigger.
        </p>
      </div>
      <div className="p-4">
        {isLoading || !p ? (
          // Ghost skeleton: the loaded Cell markup with transparent text so
          // heights match the loaded state exactly (the old h-24 block was
          // ~100px shorter than the real card and shifted everything below).
          <div aria-busy="true">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" aria-hidden="true">
              {['Dealer Gamma', 'Gamma Flip', 'Max Pain', 'Vanna Exp.', 'Charm Exp.', 'Spot'].map((label) => (
                <div key={label}>
                  <span className="text-xs">
                    <span className="skeleton rounded text-transparent select-none">{label}</span>
                  </span>
                  <p className="text-lg font-bold mt-0.5" data-numeric>
                    <span className="skeleton rounded text-transparent select-none">$000.00</span>
                  </p>
                  <span className="text-[10px]">
                    <span className="skeleton rounded text-transparent select-none">placeholder hint</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10px] leading-relaxed skeleton rounded text-transparent select-none" aria-hidden="true">
              Signed dealer gamma (puts negative). The flip is the spot where dealer gamma crosses
              zero — above it dealers dampen moves, below it they amplify them. Analytical estimate
              from open interest; not advice.
            </p>
            <span className="sr-only">Loading dealer positioning…</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Cell
                label="Dealer Gamma"
                term="dealer_gamma"
                value={p.dealer_gamma != null ? formatCompact(p.dealer_gamma) : '—'}
                tone={p.signed_regime === 'long' ? 'bull' : p.signed_regime === 'short' ? 'bear' : 'neutral'}
                // Both branches hedge the consequence. Hedging tilts the odds of
                // how a move develops; it does not guarantee either outcome, and
                // the short branch is the one that renders in the current data.
                hint={
                  p.signed_regime === 'long'
                    ? 'Positive (long) — dealers absorb moves, so price tends to stay range-bound.'
                    : p.signed_regime === 'short'
                    ? 'Negative (short) — dealers chase moves, so trends tend to run further.'
                    : 'Balanced — hedging is not pushing either way.'
                }
              />
              <Cell
                label="Gamma Flip"
                term="gamma_flip"
                value={p.gamma_flip != null ? `$${p.gamma_flip.toFixed(2)}` : '—'}
                hint={
                  p.gamma_flip != null && p.spot != null
                    ? p.spot >= p.gamma_flip
                      ? 'Price is above it — hedging tends to damp moves.'
                      : 'Price is below it — hedging tends to exaggerate moves.'
                    : undefined
                }
              />
              <Cell
                label="Max Pain"
                term="max_pain"
                value={p.max_pain != null ? `$${p.max_pain.toFixed(0)}` : '—'}
                hint="Where the most option value would expire worthless — a landmark, not a forecast."
              />
              {/* "Exp." expanded: on an options page it read equally well as
                  "expiry" or "expected". */}
              <Cell
                label="Vanna Exposure"
                term="vanna"
                value={p.vanna != null ? formatCompact(p.vanna) : '—'}
                hint="Estimated hedging change per 1% shift in expected volatility."
              />
              <Cell
                label="Charm Exposure"
                term="charm"
                value={p.charm != null ? formatCompact(p.charm) : '—'}
                hint="Estimated hedging change per day, purely from time passing."
              />
              {/* Not a live quote: `spot` is spx.current_price from the
                  maplegamma snapshot (yfinance, delayed, rebuilt about every 30
                  minutes), which is why the card beside it can show a freshness
                  chip reading an hour old. */}
              <Cell
                label="Spot"
                term="spot"
                value={p.spot != null ? `$${p.spot.toFixed(2)}` : '—'}
                hint="Last delayed quote in this snapshot, not a live price."
              />
            </div>
            <p className="mt-3 text-[10px] text-[var(--color-text-tertiary)] leading-relaxed">
              Dealer Gamma counts puts as negative, so it can point the other way from the gross GEX
              figure shown alongside it — that one adds calls and puts together. The flip is the
              price where dealer hedging crosses from damping moves to exaggerating them. Vanna and
              charm are the weakest-fitting parts of this model, so treat them as rough. The dealer
              figures are all estimated from open interest rather than observed trading, and spot is
              a delayed quote from the same snapshot — none of it is advice.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
