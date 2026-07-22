// app/options/options-client.tsx
'use client';

import React from 'react';
import { DraggableBentoGrid, type GridItem } from '@/components/layout/DraggableBentoGrid';
import { GexDexVexCard } from '@/components/feature/options/GexDexVexCard';
import { GammaWallChart } from '@/components/feature/options/GammaWallChart';
import { DealerPositioningCard } from '@/components/feature/options/DealerPositioningCard';
import { NopeCard } from '@/components/feature/options/NopeCard';
import { RegimeChip } from '@/components/primitives';
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
    return <p className="p-4 text-sm text-[var(--color-text-tertiary)]">Flow data isn’t available right now.</p>;
  }

  const topStrikes = mode?.strikes.slice(0, 10);

  return (
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
  );
}

export function OptionsClient() {
  const { data } = useQuery(gexQuery());
  const regime = data?.modes.all.gamma_regime ?? 'neutral';

  return (
    <div className="space-y-4">
      {/* A1: Regime header. The static build bakes 'neutral' and live data
          may swap in a shorter sentence — an invisible sizer of the longest
          sentence reserves the text block's height at every width, and the
          chip gets a fixed min-width, so the swap never shifts the grid. */}
      <div
        className="relative overflow-hidden flex items-center gap-4 p-4 rounded-[var(--radius-tile)] border"
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
        <RegimeChip regime={regime} className="relative z-10 min-w-[104px] justify-center" />
        <p className="relative z-10 flex-1 text-sm text-[var(--color-text-secondary)]">
          <span aria-hidden="true" className="invisible block">
            Dealer positioning is neutral — no strong directional bias from options flow.
          </span>
          <span className="absolute inset-0 flex items-center">
            {regime === 'bullish'
              ? 'Dealer hedging is stabilizing — dips are likely to be bought.'
              : regime === 'bearish'
                ? 'Dealer hedging is destabilizing — moves may accelerate to the downside.'
                : 'Dealer positioning is neutral — no strong directional bias from options flow.'}
          </span>
        </p>
      </div>

      <DraggableBentoGrid pageId="options" items={OPTIONS_ITEMS} />
    </div>
  );
}

const FlowCard = (
  <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
    <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
      <h3 className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-[0.14em]">Options Flow — Top Strikes</h3>
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
  { id: 'flow', span: 'hero', node: FlowCard },
  { id: 'gammawall', span: 'hero', node: <FeatureGate feature="gammaWalls"><GammaWallChart /></FeatureGate> },
  { id: 'alertbuilder', span: 'hero', node: <AlertRuleBuilder /> },
];
