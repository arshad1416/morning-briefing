// components/feature/market/DayPnLCard.tsx — portfolio P&L (demo)
'use client';

import React from 'react';
import { Surface, SurfaceHeader, Stat, Sparkline } from '@/components/primitives';
import { demoPortfolio } from '@/mocks';

export function DayPnLCard() {
  const { equity, dayPnL, deployedPct, sparkData } = demoPortfolio;

  return (
    <Surface span="third">
      <SurfaceHeader title="Portfolio" />
      <div className="p-4 space-y-4">
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: 'var(--color-text-tertiary)' }}>
          Simulated portfolio — not a recommendation
        </p>
        <Stat label="Equity" value={`$${equity.toLocaleString()}`} delta={dayPnL} suffix="" prefix="" />
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--color-text-tertiary)]">Deployed</span>
          <span className="text-sm font-medium" style={{ fontFamily: 'var(--font-mono)' }} data-numeric>{deployedPct.toFixed(1)}%</span>
        </div>
        <div className="h-2 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${deployedPct}%`, backgroundColor: 'var(--color-accent)' }} />
        </div>
        <Sparkline
          data={sparkData}
          fill
          color={sparkData[sparkData.length - 1] >= sparkData[0] ? 'var(--color-bull)' : 'var(--color-bear)'}
          title="Equity trend"
        />
      </div>
    </Surface>
  );
}
