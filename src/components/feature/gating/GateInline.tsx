// components/feature/gating/GateInline.tsx — compact upsell row for tight
// tiles where a full GateCard would dominate the layout. Renders no surface
// of its own; it lives inside the host tile's body.
'use client';

import React from 'react';
import Link from 'next/link';
import { LockIcon } from './LockIcon';

const TIER_LABELS = { basic: 'Basic', pro: 'Pro' } as const;

export function GateInline({
  kind,
  need,
  feature,
}: {
  kind: 'signin' | 'upgrade';
  need?: 'basic' | 'pro';
  /** Human label, lowercase mid-sentence: "the live paper-trading portfolio". */
  feature: string;
}) {
  const tierLabel = need ? TIER_LABELS[need] : null;

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0">
        <LockIcon size={14} />
      </span>
      {kind === 'signin' ? (
        <p className="text-sm text-[var(--color-text-tertiary)]">
          Start a <span className="font-semibold text-[var(--color-text-secondary)]">7-day free trial</span> to
          unlock {feature} — no card required.{' '}
          <Link href="/signup/" className="font-semibold text-[var(--color-accent)] underline underline-offset-2">
            Start free trial
          </Link>{' '}
          <Link href="/login/" className="text-[var(--color-text-tertiary)] underline underline-offset-2">
            Sign in
          </Link>
        </p>
      ) : (
        // 403 means this account already used its trial — never promise another.
        <p className="text-sm text-[var(--color-text-tertiary)]">
          {feature.charAt(0).toUpperCase() + feature.slice(1)} is included with{' '}
          {tierLabel ? `MapleGamma ${tierLabel}` : 'a paid plan'}.{' '}
          <Link href="/account/" className="font-semibold text-[var(--color-accent)] underline underline-offset-2">
            Upgrade
          </Link>
        </p>
      )}
    </div>
  );
}
