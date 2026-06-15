// components/primitives/PositionSlider.tsx — low────●────high visual range
'use client';

import React from 'react';

interface PositionSliderProps {
  value: number; // 0–1
  lowLabel?: string;
  highLabel?: string;
  className?: string;
}

export function PositionSlider({ value, lowLabel = 'Low', highLabel = 'High', className = '' }: PositionSliderProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const percent = clamped * 100;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <div className="relative h-2 bg-[var(--color-bg-elevated)] rounded-full">
        <div
          className="absolute h-full rounded-full"
          style={{
            width: `${percent}%`,
            background: 'var(--gradient-conviction)',
          }}
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 min-h-11 min-w-11 flex items-center justify-center"
          style={{ left: `calc(${percent}% - 22px)` }}
        >
          <div className="w-4 h-4 rounded-full bg-[var(--color-text-primary)] border-2 border-[var(--color-accent)] shadow-md" />
        </div>
      </div>
      <div className="flex justify-between text-xs text-[var(--color-text-tertiary)]">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}
