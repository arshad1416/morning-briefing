// components/feature/prediction/CalibrationChart.tsx — predicted vs realized.
//
// HONEST EARLY-SAMPLE STATE. The previous version plotted fabricated demo points
// and asserted "Our 80% calls hit ~79%" behind the Pro gate. Real calibration
// requires a meaningful forward-test sample, so this tile reports the current
// state instead of inventing a curve.
//
// FIX (MEDIUM data bug): that "early-sample" framing still promised "the
// chart appears once 30 trades have closed." accuracy.json (AccuracySchema,
// src/lib/schemas/market.ts) never carries a per-trade predicted probability
// — the only value this tile consumes is total_signals, a raw closed-trade
// count. No number of closed trades would ever make a real curve appear
// with that data, so the 30-trade countdown was a promise this component
// could never keep. It now says plainly that a curve needs per-trade
// probability data that is not collected yet, instead of implying one is
// coming once a counter reaches 30.
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
          We want to check whether the model&apos;s confidence holds up: when it calls something 70% likely, does it
          happen about 70% of the time? Answering that needs each trade&apos;s predicted probability, which is not
          recorded yet — only a running count of closed practice trades is available today.
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          {closedTrades.toLocaleString()} practice {closedTrades === 1 ? 'trade has' : 'trades have'} closed so far.
          We&apos;ll add the curve once trades are matched to their predicted probabilities.
        </p>
      </div>
    </Surface>
  );
}
