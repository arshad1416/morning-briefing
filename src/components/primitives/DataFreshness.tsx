// components/primitives/DataFreshness.tsx — "12s ago" + staleness dot
'use client';

import React, { useEffect, useState } from 'react';
import { formatDuration } from '@/lib/format';

interface DataFreshnessProps {
  timestamp: string;
  className?: string;
}

export function DataFreshness({ timestamp, className = '' }: DataFreshnessProps) {
  // Date.now() differs between the static-export HTML and the client — only
  // compute freshness after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const date = new Date(timestamp);

  if (!mounted) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-bg-elevated)]" aria-hidden="true" />
        <time dateTime={date.toISOString()}>—</time>
      </span>
    );
  }

  const ms = Date.now() - date.getTime();
  const isStale = ms > 300_000; // 5 minutes

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] ${className}`}
      title={`Last updated: ${date.toLocaleString()}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: isStale ? 'var(--color-caution)' : 'var(--color-accent)',
          boxShadow: isStale ? 'none' : '0 0 6px var(--color-accent)',
        }}
        aria-hidden="true"
      />
      <time dateTime={date.toISOString()}>{formatDuration(ms)}</time>
    </span>
  );
}
