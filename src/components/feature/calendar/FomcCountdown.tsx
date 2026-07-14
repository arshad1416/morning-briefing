// components/feature/calendar/FomcCountdown.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { Surface, SurfaceHeader } from '@/components/primitives';
import { demoFomc } from '@/mocks';

function getTimeRemaining() {
  const target = new Date(demoFomc.targetDate);
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, passed: true };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    passed: false,
  };
}

export function FomcCountdown() {
  // Countdown derives from the clock — compute only after mount so the
  // static-export HTML and first client render match.
  const [remaining, setRemaining] = useState<ReturnType<typeof getTimeRemaining> | null>(null);

  useEffect(() => {
    setRemaining(getTimeRemaining());
    const timer = setInterval(() => setRemaining(getTimeRemaining()), 60000);
    return () => clearInterval(timer);
  }, []);

  const { fedNote } = demoFomc;

  if (!remaining) {
    return (
      <Surface span="third">
        <SurfaceHeader title="FOMC Countdown" />
        <div className="p-4 space-y-3">
          <div className="skeleton h-12 w-40" />
          <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">{fedNote}</p>
        </div>
      </Surface>
    );
  }

  return (
    <Surface span="third">
      <SurfaceHeader title="FOMC Countdown" />
      <div className="p-4 space-y-3">
        {remaining.passed ? (
          <p className="text-sm text-[var(--color-text-secondary)]">FOMC meeting in progress or concluded</p>
        ) : (
          <div className="flex items-center gap-3" style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            <div className="text-center">
              <span className="text-3xl font-bold text-[var(--color-accent)]" data-numeric>{remaining.days}</span>
              <span className="block text-xs text-[var(--color-text-tertiary)]">days</span>
            </div>
            <span className="text-xl text-[var(--color-text-tertiary)]">:</span>
            <div className="text-center">
              <span className="text-3xl font-bold text-[var(--color-accent)]" data-numeric>{remaining.hours.toString().padStart(2, '0')}</span>
              <span className="block text-xs text-[var(--color-text-tertiary)]">hrs</span>
            </div>
            <span className="text-xl text-[var(--color-text-tertiary)]">:</span>
            <div className="text-center">
              <span className="text-3xl font-bold text-[var(--color-accent)]" data-numeric>{remaining.minutes.toString().padStart(2, '0')}</span>
              <span className="block text-xs text-[var(--color-text-tertiary)]">min</span>
            </div>
          </div>
        )}
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">{fedNote}</p>
      </div>
    </Surface>
  );
}
