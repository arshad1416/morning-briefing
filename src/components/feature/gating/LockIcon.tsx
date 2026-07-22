// components/feature/gating/LockIcon.tsx — shared lock glyph for gate UIs.
import React from 'react';

export function LockIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
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
