// components/feature/prediction/CalibrationChart.tsx — predicted vs realized
'use client';

import React from 'react';
import { Surface, SurfaceHeader, InfoTip } from '@/components/primitives';
import { demoCalibrationData } from '@/mocks';

export function CalibrationChart() {
  const data = demoCalibrationData;

  const size = 200;
  const padding = 30;

  return (
    <Surface span="half">
      <SurfaceHeader title={<InfoTip term="calibration">Calibration Chart</InfoTip>} />
      <div className="p-4 flex justify-center">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Calibration chart showing predicted vs realized probability">
          {/* Perfect calibration diagonal */}
          <line
            x1={padding}
            y1={size - padding}
            x2={size - padding}
            y2={padding}
            stroke="var(--color-border-default)"
            strokeDasharray="4,4"
          />

          {/* Data points */}
          {data.map((d, i) => {
            const x = padding + d.predicted * (size - padding * 2);
            const y = size - padding - d.actual * (size - padding * 2);
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r={4}
                fill="var(--color-accent)"
              />
            );
          })}

          {/* Axes */}
          <text x={size / 2} y={size - 5} textAnchor="middle" fill="var(--color-text-tertiary)" fontSize="10">Predicted</text>
          <text x={5} y={size / 2} textAnchor="middle" fill="var(--color-text-tertiary)" fontSize="10" transform={`rotate(-90, 10, ${size/2})`}>Actual</text>
        </svg>
      </div>
      <p className="text-xs text-[var(--color-text-tertiary)] text-center px-4 pb-3">
        Our 80% calls hit ~79%. Perfect calibration means points fall on the diagonal.
      </p>
    </Surface>
  );
}
