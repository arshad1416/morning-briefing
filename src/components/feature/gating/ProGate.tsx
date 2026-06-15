// components/feature/gating/ProGate.tsx — monetization wrapper (gatingEnabled: false)
'use client';

import React from 'react';
import { useEntitlements, FEATURES, type FeatureKey } from '@/stores/entitlements';

interface ProGateProps {
  feature: FeatureKey;
  children: React.ReactNode;
}

export function ProGate({ feature, children }: ProGateProps) {
  const can = useEntitlements((s) => s.can(feature));

  if (can) return <>{children}</>;

  const { teaser } = FEATURES[feature];

  return (
    <div className="relative">
      <div className={teaser === 'blur' ? 'blur-sm opacity-60 pointer-events-none' : ''}>
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-[var(--color-bg-overlay)] border border-[var(--color-border-default)] rounded-[var(--radius-tile)] px-6 py-4 text-center shadow-lg">
          <span className="text-lg">🔒</span>
          <p className="text-sm font-medium text-[var(--color-text-primary)] mt-2">Pro Feature</p>
          <p className="text-xs text-[var(--color-text-tertiary)] mt-1">Upgrade to access {feature}</p>
          <button
            className="mt-3 px-4 py-2 text-xs font-medium rounded-lg bg-[var(--color-accent)] text-white hover:brightness-110 transition"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}
