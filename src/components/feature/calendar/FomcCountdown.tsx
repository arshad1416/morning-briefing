// components/feature/calendar/FomcCountdown.tsx
//
// Counts down to the next FOMC decision from the published 2026 schedule and
// auto-advances past dates. The previous version counted to a single mock
// date with a hardcoded stale rate note — after that meeting it would have
// read "FOMC meeting in progress or concluded" forever.
'use client';

import React, { useEffect, useState } from 'react';
import { Surface, SurfaceHeader } from '@/components/primitives';

// Federal Reserve 2026 meeting calendar — decision announced ~2:00 PM ET on
// the second day. Extend annually when the Fed publishes the next calendar.
const FOMC_DECISIONS = [
  '2026-01-28T14:00:00-05:00',
  '2026-03-18T14:00:00-04:00',
  '2026-04-29T14:00:00-04:00',
  '2026-06-17T14:00:00-04:00',
  '2026-07-29T14:00:00-04:00',
  '2026-09-16T14:00:00-04:00',
  '2026-10-28T14:00:00-04:00',
  '2026-12-09T14:00:00-05:00',
];

const NOTE =
  'Rate decisions move index gamma fast — dealers re-hedge as the expected-path repricing hits the front expiries.';

function nextDecision(): Date | null {
  const now = Date.now();
  for (const d of FOMC_DECISIONS) {
    const t = new Date(d);
    if (t.getTime() > now) return t;
  }
  return null;
}

function getTimeRemaining() {
  const target = nextDecision();
  if (!target) return { days: 0, hours: 0, minutes: 0, passed: true, target: null as Date | null };
  const diff = target.getTime() - Date.now();
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    passed: false,
    target,
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

  if (!remaining) {
    return (
      <Surface span="third">
        <SurfaceHeader title="FOMC Countdown" />
        <div className="p-4 space-y-3">
          <div className="skeleton h-12 w-40" />
          <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">{NOTE}</p>
        </div>
      </Surface>
    );
  }

  return (
    <Surface span="third">
      <SurfaceHeader title="FOMC Countdown" />
      <div className="p-4 space-y-3">
        {remaining.passed ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            No further scheduled FOMC decisions this year.
          </p>
        ) : (
          <>
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
            {remaining.target && (
              <p className="text-xs text-[var(--color-text-secondary)]">
                Decision {remaining.target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · 2:00 PM ET
              </p>
            )}
          </>
        )}
        <p className="text-xs text-[var(--color-text-tertiary)] leading-relaxed">{NOTE}</p>
      </div>
    </Surface>
  );
}
