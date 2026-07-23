// app/options/options-client.tsx
'use client';

import React from 'react';
import { DraggableBentoGrid, type GridItem } from '@/components/layout/DraggableBentoGrid';
import { GexDexVexCard } from '@/components/feature/options/GexDexVexCard';
import { GammaWallChart } from '@/components/feature/options/GammaWallChart';
import { DealerPositioningCard } from '@/components/feature/options/DealerPositioningCard';
import { NopeCard } from '@/components/feature/options/NopeCard';
import { MaxPainCard } from '@/components/feature/options/MaxPainCard';
import { RegimeChip, InfoTip, PlainLabel } from '@/components/primitives';
import { useQuery } from '@tanstack/react-query';
import { gexDetailQuery, gexQuery } from '@/lib/query/options';
import { FeatureGate } from '@/components/feature/gating/FeatureGate';
import { GateCard } from '@/components/feature/gating/GateCard';
import { GateError } from '@/lib/api/gated';
import { AlertRuleBuilder } from '@/components/feature/MissedOpportunities';
import { formatCompact } from '@/lib/format';

function OptionsFlowTable() {
  const { data, isPending, error } = useQuery(gexDetailQuery());
  const mode = data?.modes.all;

  // Query settled without data: show the gate instead of silently rendering
  // an empty flow card (previously free users saw a header and nothing else).
  if (!mode && !isPending) {
    if (error instanceof GateError && error.kind !== 'unavailable') {
      // gex-detail.json is Pro in the Worker's file map — the fallback isn't a guess.
      return <GateCard kind={error.kind} need={error.need ?? 'pro'} feature="Strike-level options flow" flush />;
    }
    return (
      <p className="p-8 text-center text-sm text-[var(--color-text-tertiary)]">
        Options flow data isn&apos;t available right now.
      </p>
    );
  }

  // BUG FIX: was mode.strikes.slice(0, 10) — strikes[] is in ascending-strike
  // order (see the schema transform in lib/schemas/market.ts), so this always
  // rendered the ten LOWEST strikes regardless of size. On the current chain
  // that meant nine of ten rows were puts and the single largest-exposure
  // strike (750, the biggest |GEX| on the chain) never appeared. Rank by
  // |gex| to pick the ten rows that actually matter, then restore ascending-
  // strike order so the table still reads top-to-bottom as a price ladder.
  // mode is undefined while the query is pending, so this stays a ternary —
  // the ghost rows below cover that state instead of crashing on it.
  const topStrikes = mode
    ? [...mode.strikes]
        .sort((a, b) => Math.abs(b.gex) - Math.abs(a.gex))
        .slice(0, 10)
        .sort((a, b) => a.strike - b.strike)
    : undefined;

  return (
    <>
      {/* The caption lives here, not in the card header: this component may
          bail out to a GateCard or an unavailable-data message above, so a
          header-level caption would describe rows that signed-out or
          errored-out visitors never see. Column attribution matters — see
          the note on the columns below. */}
      <p className="px-3 pt-1 pb-3 text-[11px] leading-relaxed text-[var(--color-text-tertiary)]">
        Each row is one price level — its <InfoTip term="strike">strike</InfoTip> — split into its{' '}
        <InfoTip term="call">call</InfoTip> leg, which profits if the price rises, and its{' '}
        <InfoTip term="put">put</InfoTip> leg, which profits if it falls. GEX is the hedging
        exposure for that leg on its own. <InfoTip term="oi">OI</InfoTip>, DEX and VEX — contracts
        still open, the directional lean and the volatility exposure — are combined call + put
        figures for the whole strike, so when a strike shows both a call row and a put row here,
        those three columns repeat the same number on both — the source data does not split them
        by leg. These are the ten rows with the largest individual gamma exposure on the chain (a
        strike can appear twice if both its call and put make the cut), sorted back into price
        order below — a periodic snapshot of open interest, not live order flow.
      </p>
      <div className="overflow-x-auto" aria-busy={isPending || undefined}>
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
            {/* Ghost pending rows: same markup as the loaded top-10 slice with
                transparent text, so pending → loaded is height-identical. */}
            {!topStrikes &&
              Array.from({ length: 10 }, (_, i) => (
                <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }} aria-hidden="true">
                  <td className="py-2 px-3" data-numeric>
                    <span className="skeleton rounded text-transparent select-none">$000</span>
                  </td>
                  <td className="py-2 px-3">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold tracking-wider border border-transparent skeleton text-transparent select-none">
                      CALL
                    </span>
                  </td>
                  {/* ghost widths approximate real values so auto table layout
                      doesn't redistribute columns when data lands */}
                  <td className="py-2 px-3 text-right" data-numeric>
                    <span className="skeleton rounded text-transparent select-none">00,000</span>
                  </td>
                  {[0, 1, 2].map((c) => (
                    <td key={c} className="py-2 px-3 text-right" data-numeric>
                      <span className="skeleton rounded text-transparent select-none">000.0M</span>
                    </td>
                  ))}
                </tr>
              ))}
            {topStrikes?.map((s) => {
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
  // modes.all.gamma_regime is derived from the legacy GROSS total_gex, which
  // is positive by construction — it can never read bearish. Use the signed
  // dealer greeks instead (the same signal DealerPositioningCard shows):
  // dealers long gamma stabilize (bullish), short gamma amplify moves
  // (bearish); fall back to spot vs the zero-gamma flip when the signed
  // number is missing.
  const p = data?.positioning;
  const regime: 'bullish' | 'bearish' | 'neutral' =
    p == null
      ? 'neutral'
      : p.signed_regime === 'long'
      ? 'bullish'
      : p.signed_regime === 'short'
      ? 'bearish'
      : p.gamma_flip != null && p.spot != null
      ? p.spot >= p.gamma_flip
        ? 'bullish'
        : 'bearish'
      : 'neutral';

  return (
    <div className="space-y-4">
      {/* A1: Regime header. Stacks below sm: the chip column carries a
          two-line plain-English caption and the sentence beside it runs up
          to ~340 characters, so a single unwrapped flex row squeezed both
          at phone widths. Within the sentence, an invisible sizer built
          from the longest of the three regime variants reserves the text
          block's height at every width, and the chip gets a fixed
          min-width, so a live-data swap between regimes never shifts the
          grid. */}
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
            itself lives in a shared primitive. min-w/justify-center keep the
            chip's own footprint stable across regimes. */}
        <div className="relative z-10 flex flex-col items-start gap-1">
          <InfoTip term="gamma_regime">
            <RegimeChip regime={regime} className="min-w-[104px] justify-center" />
          </InfoTip>
          <PlainLabel term="gamma_regime" />
        </div>
        <p className="relative z-10 flex-1 text-sm text-[var(--color-text-secondary)]">
          {/* This sentence must describe SIGNED dealer gamma, not the gross GEX
              figure shown in the card below. The regime used to be derived from
              the gross total, in which puts are stored positive — so it was
              structurally almost always "bullish" and said so. It now comes from
              signed dealer gamma, which can be negative while gross GEX is
              positive; wording that referred to "total gamma exposure" would
              therefore contradict the number displayed alongside it.
              The invisible span below is the longest (bearish) variant — it
              reserves the block's height so the live-data swap between
              regimes never shifts the grid; the real text is layered on top. */}
          <span aria-hidden="true" className="invisible block">
            Dealers are net short gamma, so their hedging leans toward amplifying moves rather than damping them. That means bigger swings in either direction — it is not a forecast that prices will fall. The gross GEX figure below adds calls and puts together, so it can look positive even now; this reading counts puts as negative.
          </span>
          <span className="absolute inset-0 flex items-center">
            {regime === 'bullish'
              ? 'Dealers are net long gamma, so their hedging leans toward damping moves rather than amplifying them. That is a read on how steady the market is, not a forecast that prices will rise. The gross GEX figure below adds calls and puts together, so it stays positive either way — this reading counts puts as negative.'
              : regime === 'bearish'
              ? 'Dealers are net short gamma, so their hedging leans toward amplifying moves rather than damping them. That means bigger swings in either direction — it is not a forecast that prices will fall. The gross GEX figure below adds calls and puts together, so it can look positive even now; this reading counts puts as negative.'
              : 'Dealer gamma is close to flat, so hedging is not pushing the market either way right now.'}
          </span>
        </p>
      </div>

      <DraggableBentoGrid pageId="options" items={OPTIONS_ITEMS} />
    </div>
  );
}

// Renamed from "Options Flow — Top Strikes": there is no order-flow or volume
// data in this table — every column is derived from static open interest, not
// live trades. (The rows themselves ARE now ranked by |GEX| — see the BUG FIX
// comment on topStrikes in OptionsFlowTable above — just displayed back in
// strike order, so "Top Strikes" was wrong about the data source, not the
// ranking.)
const FlowCard = (
  <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">Open Interest &amp; Exposure by Strike</h3>
      {/* The explanation of the columns lives inside <OptionsFlowTable />, which
          may render a GateCard instead of the table for signed-out visitors.
          Keeping it here left those visitors with a paragraph describing a
          table that is not on their screen. */}
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
  { id: 'nope', span: 'half', node: <FeatureGate feature="nope"><NopeCard /></FeatureGate> },
  { id: 'maxpain', span: 'half', node: <FeatureGate feature="maxPain"><MaxPainCard /></FeatureGate> },
  { id: 'flow', span: 'hero', node: FlowCard },
  { id: 'gammawall', span: 'hero', node: <FeatureGate feature="gammaWalls"><GammaWallChart /></FeatureGate> },
  { id: 'alertbuilder', span: 'hero', node: <AlertRuleBuilder /> },
];
