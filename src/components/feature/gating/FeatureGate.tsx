// components/feature/gating/FeatureGate.tsx — client-side monetization wrapper.
//
// Unlike GateCard (which reflects a server 401/403 for R2-gated files), this
// wraps features whose data is public — the gate is cosmetic. It derives the
// tier from the real session (/api/auth/me) so it agrees with the
// server-gated pages: trial counts as pro, basic ranks below pro.
'use client';

import React from 'react';
import Link from 'next/link';
import { FEATURES, NEED_RANK, entitlementRank, type FeatureKey } from '@/stores/entitlements';
import { useMe } from '@/lib/auth/useMe';
import { LockIcon } from './LockIcon';

interface FeatureGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

const FEATURE_LABELS: Record<FeatureKey, string> = {
  walkforward: 'Walk-forward analysis',
  simulation: 'Live simulation',
  gammaWalls: 'Gamma Walls',
  nope: 'NOPE Flow Estimate',
  calibration: 'Model Calibration',
};

const TIER_LABELS = { basic: 'Basic', pro: 'Pro' } as const;

export function FeatureGate({ feature, children }: FeatureGateProps) {
  const { data: me, isLoading } = useMe();

  const { minTier, teaser } = FEATURES[feature];
  const userRank = entitlementRank(me?.entitlement);
  // While the session check is in flight, render ungated — a brief expose
  // beats flashing a lock at every entitled user on every load.
  const can = isLoading || userRank >= NEED_RANK[minTier];

  if (can) return <>{children}</>;

  // Signed-out visitors get the trial pitch (every new account starts a 7-day
  // trial); signed-in under-tier users have already consumed their trial, so
  // never promise a second one — send them to their account's plan cards,
  // where checkout actually lives.
  const signedOut = !me;
  const tierLabel = TIER_LABELS[minTier];

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
            Included with MapleGamma {tierLabel}
          </p>
          <Link
            href={signedOut ? '/signup/' : '/account/'}
            className="mt-4 inline-flex items-center justify-center px-4 py-2 text-xs font-semibold rounded-lg transition hover:bg-[var(--color-accent-fg)]"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            {signedOut ? 'Start 7-day free trial' : `Upgrade to ${tierLabel}`}
          </Link>
          {signedOut && (
            <p className="text-[10px] text-[var(--color-text-tertiary)] mt-2">No card required</p>
          )}
        </div>
      </div>
    </div>
  );
}
