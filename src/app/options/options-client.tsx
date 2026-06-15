// app/options/options-client.tsx
'use client';

import React from 'react';
import { BentoGrid, BentoTile } from '@/components/layout/BentoGrid';
import { GexDexVexCard } from '@/components/feature/options/GexDexVexCard';
import { GammaWallChart } from '@/components/feature/options/GammaWallChart';
import { RegimeChip } from '@/components/primitives';
import { useQuery } from '@tanstack/react-query';
import { gexQuery } from '@/lib/query/options';
import { ProGate } from '@/components/feature/gating/ProGate';
import { CompareMode, AlertRuleBuilder } from '@/components/feature/MissedOpportunities';
import { formatCompact } from '@/lib/format';

function OptionsFlowTable() {
  const { data } = useQuery(gexQuery());
  const mode = data?.modes.all;

  if (!mode) return null;

  const topStrikes = mode.strikes.slice(0, 10);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
            <th className="text-left py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Strike</th>
            <th className="text-left py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">Type</th>
            <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">OI</th>
            <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">GEX</th>
            <th className="text-right py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">DEX</th>
          </tr>
        </thead>
        <tbody>
          {topStrikes.map((s) => (
            <tr key={`${s.strike}-${s.type}`} className="border-b hover:bg-[var(--color-bg-elevated)] transition-colors" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <td className="py-2 px-3 text-[var(--color-text-primary)]" data-numeric>${s.strike.toFixed(0)}</td>
              <td className="py-2 px-3">
                <span style={{ color: s.type === 'C' ? 'var(--color-bull)' : 'var(--color-bear)' }}>{s.type === 'C' ? 'CALL' : 'PUT'}</span>
              </td>
              <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]" data-numeric>{s.oi.toLocaleString()}</td>
              <td className="py-2 px-3 text-right text-[var(--color-text-primary)]" data-numeric>{formatCompact(s.gex)}</td>
              <td className="py-2 px-3 text-right text-[var(--color-text-secondary)]" data-numeric>{formatCompact(s.dex)}</td>
            </tr>
          ))}
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
      <div className="flex items-center gap-4 p-4 rounded-[var(--radius-tile)]" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
        <RegimeChip regime={regime} />
        <p className="text-sm text-[var(--color-text-secondary)]">
          {regime === 'bullish'
            ? 'Dealer hedging is stabilizing — dips are likely to be bought.'
            : regime === 'bearish'
            ? 'Dealer hedging is destabilizing — moves may accelerate to the downside.'
            : 'Dealer positioning is neutral — no strong directional bias from options flow.'}
        </p>
      </div>

      <BentoGrid>
        {/* A2: GEX/DEX/VEX summary */}
        <BentoTile span="half">
          <GexDexVexCard />
        </BentoTile>

        {/* A2: Options flow table */}
        <BentoTile span="half">
          <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] rounded-[var(--radius-tile)] shadow-[var(--shadow-tile)] overflow-hidden">
            <div className="px-4 py-3 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
              <h3 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Options Flow — Top Strikes</h3>
            </div>
            <div className="p-2">
              <OptionsFlowTable />
            </div>
          </div>
        </BentoTile>

        {/* A3: Gamma Wall (hero) */}
        <BentoTile span="hero">
          <ProGate feature="gammaWalls">
            <GammaWallChart />
          </ProGate>
        </BentoTile>

        {/* Missed opportunity placeholders */}
        <BentoTile span="half">
          <CompareMode />
        </BentoTile>
        <BentoTile span="half">
          <AlertRuleBuilder />
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
