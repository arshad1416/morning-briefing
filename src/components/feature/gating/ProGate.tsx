// components/feature/gating/ProGate.tsx — monetization wrapper (gatingEnabled: false)
'use client';

import React from 'react';
import Link from 'next/link';
import { useEntitlements, FEATURES, type FeatureKey } from '@/stores/entitlements';

interface ProGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  gammaWalls: 'Gamma Walls',
  calibration: 'Model Calibration',
  scenarioSim: 'Scenario Simulator',
  congressTrades: 'Congress Trades',
  briefingExport: 'Briefing Export',
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
  const can = useEntitlements((s) => s.can(feature));

  if (can) return <>{children}</>;

  const { teaser } = FEATURES[feature];

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
