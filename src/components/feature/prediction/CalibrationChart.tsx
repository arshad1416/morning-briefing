// components/feature/prediction/CalibrationChart.tsx — predicted vs realized.
//
// HONEST EARLY-SAMPLE STATE. The previous version plotted fabricated demo points
// and asserted "Our 80% calls hit ~79%" behind the Pro gate. Real calibration
// requires a meaningful forward-test sample, so this tile reports the current
// state instead of inventing a curve.
'use client';

import React from 'react';
import { Surface, SurfaceHeader, InfoTip } from '@/components/primitives';
import { useQuery } from '@tanstack/react-query';
import { accuracyQuery } from '@/lib/query/options';
import { GateError } from '@/lib/api/gated';

export function CalibrationChart() {
  const { data, isLoading, isError, error } = useQuery(accuracyQuery());

  if (isError) {
    if (error instanceof GateError && error.kind !== 'unavailable') {
      // Quiet frame only — the FeatureGate overlay on /models/ is the single
      // pitch (see BacktestSummary).
      return (
        <Surface span="half">
          <SurfaceHeader title={<InfoTip term="calibration">Calibration Chart</InfoTip>} />
          <div className="p-4">
            <div className="h-56 rounded-[var(--radius-chip)] bg-[var(--color-bg-elevated)]" />
          </div>
        </Surface>
      );
    }
    return (
      <Surface span="half">
        <SurfaceHeader title={<InfoTip term="calibration">Calibration Chart</InfoTip>} />
        <div className="p-6 text-center text-sm text-[var(--color-text-tertiary)]">
          Calibration data isn&apos;t available right now.
        </div>
      </Surface>
    );
  }

  if (isLoading || !data) {
    return (
      <Surface span="half">
        <SurfaceHeader title={<InfoTip term="calibration">Calibration Chart</InfoTip>} />
        <div className="p-4 skeleton h-48" />
      </Surface>
    );
  }

  const closedTrades = data.total_signals;
  const sampleTarget = 30;
  const progress = Math.min(100, (closedTrades / sampleTarget) * 100);
  return (
    <Surface span="half">
      <SurfaceHeader title={<InfoTip term="calibration">Calibration Chart</InfoTip>} />
      <div className="p-6 flex flex-col items-center justify-center text-center min-h-[200px]">
        <svg
          viewBox="0 0 24 24"
          width={28}
          height={28}
          fill="none"
          stroke="var(--color-text-tertiary)"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="mb-3"
          aria-hidden="true"
        >
          <path d="M4 20L20 4" strokeDasharray="3,3" />
          <path d="M4 20h16" />
          <path d="M4 20V4" />
        </svg>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Calibration tracking is live. {closedTrades.toLocaleString()} closed {closedTrades === 1 ? 'trade has' : 'trades have'} been matched to predicted probabilities.
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          The curve publishes at {sampleTarget} closed trades. We won&apos;t show a calibration line built on too little evidence.
        </p>
        <div className="mt-4 w-full max-w-xs">
          <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
            <div className="h-full rounded-full bg-[var(--color-accent)]" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-1 text-[11px] text-[var(--color-text-tertiary)]">
            {closedTrades.toLocaleString()} / {sampleTarget} closed trades
          </p>
        </div>
      </div>
    </Surface>
  );
}
