// app/positions/positions-client.tsx
'use client';

import React from 'react';
import { BentoGrid, BentoTile } from '@/components/layout/BentoGrid';
import { DayPnLCard } from '@/components/feature/market/DayPnLCard';
import { ActionQueue } from '@/components/feature/positions/ActionQueue';
import { Surface, SurfaceHeader } from '@/components/primitives';

function PositionsTablePlaceholder() {
  return (
    <Surface span="hero">
      <SurfaceHeader title="Positions" />
      <div className="p-4">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
                {['Ticker', 'Entry', 'Current', 'P&L', 'P&L %', 'Duration'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs text-[var(--color-text-tertiary)] font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { ticker: 'IBIT', entry: 57.36, current: 41.56, pnl: -27.5, pnlPct: -27.5, days: 17 },
                { ticker: 'IBIT', entry: 58.74, current: 41.56, pnl: -29.2, pnlPct: -29.2, days: 17 },
                { ticker: 'IBIT', entry: 56.85, current: 41.56, pnl: -26.9, pnlPct: -26.9, days: 16 },
                { ticker: 'TLT', entry: 115.00, current: 112.50, pnl: -2.2, pnlPct: -2.2, days: 5 },
                { ticker: 'XLU', entry: 62.00, current: 63.20, pnl: 1.9, pnlPct: 1.9, days: 3 },
              ].map((p) => (
                <tr key={`${p.ticker}-${p.entry}`} className="border-b hover:bg-[var(--color-bg-elevated)] transition-colors" style={{ borderColor: 'var(--color-border-subtle)' }}>
                  <td className="py-2 px-3 text-[var(--color-text-primary)] font-medium">{p.ticker}</td>
                  <td className="py-2 px-3 text-[var(--color-text-secondary)]" data-numeric>${p.entry.toFixed(2)}</td>
                  <td className="py-2 px-3 text-[var(--color-text-primary)]" data-numeric>${p.current.toFixed(2)}</td>
                  <td className="py-2 px-3" data-numeric>
                    <span style={{ color: p.pnl >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                      {p.pnl >= 0 ? '▲' : '▼'} ${Math.abs(p.pnl).toFixed(1)}
                    </span>
                  </td>
                  <td className="py-2 px-3" data-numeric>
                    <span style={{ color: p.pnlPct >= 0 ? 'var(--color-bull)' : 'var(--color-bear)' }}>
                      {p.pnlPct >= 0 ? '+' : ''}{p.pnlPct.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-2 px-3 text-[var(--color-text-tertiary)]" data-numeric>{p.days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Surface>
  );
}

export function PositionsClient() {
  return (
    <div className="space-y-4">
      <BentoGrid>
        <BentoTile span="half">
          <DayPnLCard />
        </BentoTile>
        <BentoTile span="half">
          <ActionQueue />
        </BentoTile>
        <BentoTile span="hero">
          <PositionsTablePlaceholder />
        </BentoTile>
      </BentoGrid>
    </div>
  );
}
