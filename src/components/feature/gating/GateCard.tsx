// components/feature/gating/GateCard.tsx — server-driven gate state card.
//
// Rendered when a premium fetch comes back 401/403 from the Worker data gate
// (or the file simply isn't generated). Unlike ProGate (a client-side wrapper),
// this reflects what the SERVER decided — the bytes never reached the browser.
'use client';

import React from 'react';
import Link from 'next/link';
import type { GateKind } from '@/lib/api/gated';

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

export function GateCard({
  kind,
  need,
  feature,
}: {
  kind: GateKind;
  need?: 'basic' | 'pro';
  feature: string;
}) {
  const tierLabel = need === 'pro' ? 'Pro' : 'Basic';

  const copy =
    kind === 'signin'
      ? {
          title: `Unlock ${feature} with a 7-day free trial`,
          sub: 'Create an account to start your free trial — no card required.',
          cta: 'Start free trial',
          href: '/signup/',
          alt: { label: 'I already have an account', href: '/login/' },
        }
      : kind === 'upgrade'
        ? {
            title: `${feature} is a ${tierLabel} feature`,
            sub: `Upgrade your plan to keep going — cancel anytime.`,
            cta: `Upgrade to ${tierLabel}`,
            href: '/#pricing',
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
      className="border rounded-[var(--radius-tile)] px-8 py-10 text-center"
      style={{
        backgroundColor: 'var(--color-bg-surface)',
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
