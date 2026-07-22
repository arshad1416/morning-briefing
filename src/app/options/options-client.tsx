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
import { ProGate } from '@/components/feature/gating/ProGate';
import { AlertRuleBuilder } from '@/components/feature/MissedOpportunities';
import { formatCompact } from '@/lib/format';

function OptionsFlowTable() {
  const { data, isPending } = useQuery(gexDetailQuery());
  const mode = data?.modes.all;

  // Query settled without data (gated or unavailable) — hide the table.
  if (!mode && !isPending) return null;

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
          {/* Pending rows use the same cell chrome as the loaded top-10 slice,
              so pending → loaded is row-for-row height-identical (no shift). */}
          {!topStrikes &&
            Array.from({ length: 10 }, (_, i) => (
              <tr key={i} className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {[0, 1, 2, 3, 4, 5].map((c) => (
                  <td key={c} className="py-2 px-3">
                    <div className="skeleton h-5" />
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
      {/* A1: Regime header */}
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
        <RegimeChip regime={regime} className="relative z-10" />
        <p className="relative z-10 text-sm text-[var(--color-text-secondary)]">
          {regime === 'bullish'
            ? 'Dealer hedging is stabilizing — dips are likely to be bought.'
            : regime === 'bearish'
            ? 'Dealer hedging is destabilizing — moves may accelerate to the downside.'
            : 'Dealer positioning is neutral — no strong directional bias from options flow.'}
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
  { id: 'nope', span: 'half', node: <ProGate feature="nope"><NopeCard /></ProGate> },
  { id: 'flow', span: 'hero', node: FlowCard },
  { id: 'gammawall', span: 'hero', node: <ProGate feature="gammaWalls"><GammaWallChart /></ProGate> },
  { id: 'alertbuilder', span: 'hero', node: <AlertRuleBuilder /> },
];
