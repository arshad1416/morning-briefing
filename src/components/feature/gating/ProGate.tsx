// components/feature/gating/ProGate.tsx — client-side monetization wrapper.
//
// Unlike GateCard (which reflects a server 401/403 for R2-gated files), this
// wraps features whose data is public — the gate is cosmetic. It derives the
// tier from the real session (/api/auth/me) so it agrees with the
// server-gated pages: trial counts as pro, basic ranks below pro.
'use client';

import React from 'react';
import Link from 'next/link';
import { FEATURES, type FeatureKey } from '@/stores/entitlements';
import { useMe } from '@/lib/auth/useMe';
import { PlainLabel } from '@/components/primitives';

interface ProGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  // `walkforward` gates three different tiles (BacktestSummary, AccuracyStats
  // and WalkForwardTile in models-client), so the old "Walk-forward analysis"
  // was simply the wrong name over two of the three locks.
  walkforward: 'Model track record & walk-forward tests',
  simulation: 'Live simulation',
  gammaWalls: 'Gamma Walls',
  // Was "NOPE Flow Estimate". The generator's own methodology note says this is
  // estimated from option-chain volume and Black-Scholes delta and is NOT
  // real-time order flow — so the word "Flow" claimed the one thing it isn't.
  nope: 'NOPE options-pressure estimate',
  calibration: 'Model Calibration',
  scenarioSim: 'Scenario Simulator',
  congressTrades: 'US lawmakers’ stock trades',
  briefingExport: 'Briefing Export',
};

// Plain-English caption under the lock label, read from the glossary. Only keys
// whose entry is true of everything behind that lock appear here — `walkforward`
// covers three unrelated tiles, so no single definition fits it.
const FEATURE_TERMS: Partial<Record<FeatureKey, string>> = {
  simulation: 'live_simulation',
  gammaWalls: 'gamma_wall',
  nope: 'nope',
  calibration: 'calibration',
};

function LockIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      stroke="var(--color-accent)"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V7.5a4 4 0 0 1 8 0V11" />
      <circle cx="12" cy="15.5" r="1" fill="var(--color-accent)" stroke="none" />
    </svg>
  );
}

export function ProGate({ feature, children }: ProGateProps) {
  const { data: me, isLoading } = useMe();

  const { minTier, teaser } = FEATURES[feature];
  const ent = me?.entitlement;
  const userRank = !ent?.entitled
    ? 0
    : ent.tier === 'trial' || ent.tier === 'pro'
      ? 2
      : ent.tier === 'basic'
        ? 1
        : 0;
  const needRank = minTier === 'pro' ? 2 : 0;
  // While the session check is in flight, render ungated — a brief expose
  // beats flashing a lock at every entitled user on every load.
  const can = isLoading || userRank >= needRank;

  if (can) return <>{children}</>;

  return (
    <div className="relative">
      <div className={teaser === 'blur' ? 'blur-md opacity-50 pointer-events-none' : ''}>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center backdrop-blur-sm rounded-[var(--radius-tile)]">
        <div
          className="border rounded-[var(--radius-tile)] px-8 py-6 text-center"
          style={{
            backgroundColor: 'color-mix(in srgb, var(--color-bg-surface) 88%, transparent)',
            borderColor: 'var(--color-border-default)',
            boxShadow: 'var(--shadow-tile)',
          }}
        >
          <span
            className="inline-flex items-center justify-center w-10 h-10 rounded-full border"
            style={{
              backgroundColor: 'var(--color-accent-dim)',
              borderColor: 'color-mix(in srgb, var(--color-accent) 25%, transparent)',
            }}
          >
            <LockIcon />
          </span>
          <p className="text-sm font-semibold text-[var(--color-text-primary)] mt-3">
            {FEATURE_LABELS[feature]}
          </p>
          {FEATURE_TERMS[feature] && <PlainLabel term={FEATURE_TERMS[feature]!} className="mt-1" />}
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">
            Unlock with MapleGamma Pro
          </p>
          <Link
            href="/#pricing"
            className="mt-4 inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg transition hover:bg-[var(--color-accent-fg)]"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            Upgrade to Pro
          </Link>
        </div>
      </div>
    </div>
  );
}
