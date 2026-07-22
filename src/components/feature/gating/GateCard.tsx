// components/feature/gating/GateCard.tsx — server-driven gate state card.
//
// Rendered when a premium fetch comes back 401/403 from the Worker data gate
// (or the file simply isn't generated). Unlike FeatureGate (a client-side wrapper),
// this reflects what the SERVER decided — the bytes never reached the browser.
'use client';

import React from 'react';
import Link from 'next/link';
import type { GateKind } from '@/lib/api/gated';
import { LockIcon } from './LockIcon';

export function GateCard({
  kind,
  need,
  feature,
  flush = false,
}: {
  kind: GateKind;
  need?: 'basic' | 'pro';
  feature: string;
  /** Drop the card's own surface (border/bg/shadow) when embedded inside an
   *  existing tile so it doesn't render a card-within-a-card. */
  flush?: boolean;
}) {
  // The Worker's 403 doesn't always carry a `need` tier (e.g. no_subscription).
  // Never guess a tier we don't know — a wrong upsell sells the wrong plan.
  const tierLabel = need === 'pro' ? 'Pro' : need === 'basic' ? 'Basic' : null;

  const copy =
    kind === 'signin'
      ? {
          title: `Unlock ${feature} with a 7-day free trial — no card required`,
          sub: 'Create an account and start today.',
          cta: 'Start free trial',
          href: '/signup/',
          alt: { label: 'I already have an account', href: '/login/' },
        }
      : kind === 'upgrade'
        ? {
            // A 403 means the user is signed in (their trial is spent), so the
            // CTA goes to /account/ where the plan cards + checkout live — not
            // the logged-out marketing page.
            title: tierLabel ? `${feature} is a ${tierLabel} feature` : `${feature} is a premium feature`,
            sub: 'Upgrade from your account in under a minute — cancel anytime.',
            cta: tierLabel ? `Upgrade to ${tierLabel}` : 'See plans',
            href: '/account/',
            alt: null,
          }
        : {
            title: `${feature} data isn't available yet`,
            sub: 'The next data run will populate this page automatically.',
            cta: null as string | null,
            href: '',
            alt: null,
          };

  return (
    <div
      className={flush ? 'px-8 py-10 text-center' : 'border rounded-[var(--radius-tile)] px-8 py-10 text-center'}
      style={
        flush
          ? undefined
          : {
              backgroundColor: 'var(--color-bg-surface)',
              borderColor: 'var(--color-border-default)',
              boxShadow: 'var(--shadow-tile)',
            }
      }
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
      <p className="text-base font-semibold text-[var(--color-text-primary)] mt-3">{copy.title}</p>
      <p className="text-sm text-[var(--color-text-tertiary)] mt-1">{copy.sub}</p>
      {copy.cta && (
        <div className="mt-5 flex items-center justify-center gap-3">
          <Link
            href={copy.href}
            className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-lg transition hover:bg-[var(--color-accent-fg)]"
            style={{ backgroundColor: 'var(--color-accent)', color: 'var(--color-on-accent)' }}
          >
            {copy.cta}
          </Link>
          {copy.alt && (
            <Link
              href={copy.alt.href}
              className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {copy.alt.label}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
