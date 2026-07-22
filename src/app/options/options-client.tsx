// app/options/options-client.tsx
'use client';

import React from 'react';
import { DraggableBentoGrid, type GridItem } from '@/components/layout/DraggableBentoGrid';
import { GexDexVexCard } from '@/components/feature/options/GexDexVexCard';
import { GammaWallChart } from '@/components/feature/options/GammaWallChart';
import { DealerPositioningCard } from '@/components/feature/options/DealerPositioningCard';
import { NopeCard } from '@/components/feature/options/NopeCard';
import { RegimeChip, InfoTip, PlainLabel } from '@/components/primitives';
import { useQuery } from '@tanstack/react-query';
import { gexDetailQuery, gexQuery } from '@/lib/query/options';
import { ProGate } from '@/components/feature/gating/ProGate';
import { AlertRuleBuilder } from '@/components/feature/MissedOpportunities';
import { formatCompact } from '@/lib/format';

function OptionsFlowTable() {
  const { data } = useQuery(gexDetailQuery());
  const mode = data?.modes.all;

  if (!mode) return null;

  const topStrikes = mode.strikes.slice(0, 10);

  return (
    <>
      {/* The caption lives here, not in the card header: this component renders
          nothing until `gexDetailQuery` resolves, and that file is Pro-gated, so
          a header-level caption described rows that signed-out visitors never
          see. Column attribution matters — see the note on the columns below. */}
      <p className="px-3 pt-1 pb-3 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
        Each row is one price level — its <InfoTip term="strike">strike</InfoTip> — split into its{' '}
        <InfoTip term="call">call</InfoTip> leg, which profits if the price rises, and its{' '}
        <InfoTip term="put">put</InfoTip> leg, which profits if it falls. GEX is the hedging
        exposure for that leg on its own. <InfoTip term="oi">OI</InfoTip>, DEX and VEX — contracts
        still open, the directional lean and the volatility exposure — are combined call + put
        figures for the whole strike, listed once per strike, so the strike&rsquo;s other leg shows
        zero. This is a slice of the option chain rather than a ranking, taken from a periodic
        snapshot of open interest — not live order flow.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <th className="text-left py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Strike</th>
              <th className="text-left py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Type</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">OI</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">GEX</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">DEX</th>
              <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">VEX</th>
            </tr>
          </thead>
          <tbody>
            {topStrikes.map((s) => {
              const isCall = s.type === 'C';
              return (
                <tr key={`${s.strike}-${s.type}`} className="border-b hover:bg-[rgba(255,255,255,0.03)] transition-colors" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-2 px-3 text-[var(--color-text-primary)]" data-numeric>${s.strike.toFixed(0)}</td>
                  <td className="py-2 px-3">
                    <span
                      className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider border"
                      style={{
                        color: isCall ? 'var(--color-bull)' : 'var(--color-bear)',
                        backgroundColor: isCall ? 'var(--color-bull-soft)' : 'var(--color-bear-soft)',
                        borderColor: `color-mix(in srgb, ${isCall ? 'var(--color-bull)' : 'var(--color-bear)'} 25%, transparent)`,
                      }}
                    >
                      {isCall ? 'CALL' : 'PUT'}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]" data-numeric>{s.oi.toLocaleString()}</td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-primary)]" data-numeric>{formatCompact(s.gex)}</td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]" data-numeric>{formatCompact(s.dex)}</td>
                  <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]" data-numeric>{formatCompact(s.vex)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function OptionsClient() {
  const { data } = useQuery(gexQuery());
  const regime = data?.modes.all.gamma_regime ?? 'neutral';

  return (
    <div className="space-y-4">
      {/* A1: Regime header */}
      {/* Stacks below sm: the chip column now carries a two-line plain-English
          caption and the sentence beside it grew from ~55 to ~340 characters, so
          a single unwrapped flex row squeezed both at phone widths. */}
      <div
        className="relative overflow-hidden flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4 p-4 rounded-[var(--radius-tile)] border"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <span
          aria-hidden="true"
          className="glow-orb -top-20 -left-10"
          style={{
            ['--glow-color' as string]:
              regime === 'bullish'
                ? 'rgba(16,185,129,0.12)'
                : regime === 'bearish'
                ? 'rgba(255,69,87,0.12)'
                : 'rgba(139,139,150,0.08)',
          }}
        />
        {/* The chip reads BULLISH/BEARISH, but it is the sign of gross gamma
            exposure — a read on market stability, not a direction call. The
            subtitle and the sentence beside it say so, since the chip wording
            itself lives in a shared primitive. */}
        <div className="relative z-10 flex flex-col items-start gap-1">
          <InfoTip term="gamma_regime">
            <RegimeChip regime={regime} />
          </InfoTip>
          <PlainLabel term="gamma_regime" />
        </div>
        <p className="relative z-10 text-sm text-[var(--color-text-secondary)]">
          {/* This sentence must describe SIGNED dealer gamma, not the gross GEX
              figure shown in the card below. The regime used to be derived from
              the gross total, in which puts are stored positive — so it was
              structurally almost always "bullish" and said so. It now comes from
              signed dealer gamma, which can be negative while gross GEX is
              positive; wording that referred to "total gamma exposure" would
              therefore contradict the number displayed alongside it. */}
          {regime === 'bullish'
            ? 'Dealers are net long gamma, so their hedging leans toward damping moves rather than amplifying them. That is a read on how steady the market is, not a forecast that prices will rise. The gross GEX figure below adds calls and puts together, so it stays positive either way — this reading counts puts as negative.'
            : regime === 'bearish'
            ? 'Dealers are net short gamma, so their hedging leans toward amplifying moves rather than damping them. That means bigger swings in either direction — it is not a forecast that prices will fall. The gross GEX figure below adds calls and puts together, so it can look positive even now; this reading counts puts as negative.'
            : 'Dealer gamma is close to flat, so hedging is not pushing the market either way right now.'}
        </p>
      </div>

      <DraggableBentoGrid pageId="options" items={OPTIONS_ITEMS} />
    </div>
  );
}

// Renamed from "Options Flow — Top Strikes": there is no order-flow or volume
// data in this table (every column is derived from static open interest), and
// the rows are not ranked — the component slices the first ten of a strike-
// ordered array, so "Top" was wrong on both counts.
const FlowCard = (
  <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">Open Interest &amp; Exposure by Strike</h3>
      {/* The explanation of the columns lives inside <OptionsFlowTable />, which
          renders only once the Pro-gated detail file has loaded. Keeping it here
          left signed-out visitors with a paragraph describing a table that is
          not on their screen. */}
    </div>
    <div className="p-2">
      <OptionsFlowTable />
    </div>
  </div>
);

// Cleaner default: the two compact metric cards paired (even heights), the tall
// flow table and Pro gamma wall full-width, the Coming-Soon builder last.
const OPTIONS_ITEMS: GridItem[] = [
  { id: 'gexdexvex', span: 'half', node: <GexDexVexCard /> },
  { id: 'dealer', span: 'half', node: <DealerPositioningCard /> },
  { id: 'nope', span: 'half', node: <ProGate feature="nope"><NopeCard /></ProGate> },
  { id: 'flow', span: 'hero', node: FlowCard },
  { id: 'gammawall', span: 'hero', node: <ProGate feature="gammaWalls"><GammaWallChart /></ProGate> },
  { id: 'alertbuilder', span: 'hero', node: <AlertRuleBuilder /> },
];
