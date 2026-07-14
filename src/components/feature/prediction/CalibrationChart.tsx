// components/feature/prediction/CalibrationChart.tsx — predicted vs realized.
//
// HONEST EMPTY STATE. The previous version plotted fabricated demo points and
// asserted "Our 80% calls hit ~79%" behind the Pro gate — invented accuracy
// presented as model transparency. Real calibration requires the forward-test
// signal history (shadow p_win tracking, accumulating since Jul 2026) to reach
// a meaningful sample; until that dataset is published, this tile says so
// instead of inventing a curve.
'use client';

import React from 'react';
import { Surface, SurfaceHeader, InfoTip } from '@/components/primitives';

export function CalibrationChart() {
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
          Calibration tracking is live — every signal&apos;s predicted probability is recorded
          against its realized outcome.
        </p>
        <p className="mt-2 text-xs text-[var(--color-text-tertiary)]">
          The curve publishes once the forward-test sample is statistically meaningful. We won&apos;t
          show a calibration line built on too few trades.
        </p>
      </div>
    </Surface>
  );
}
