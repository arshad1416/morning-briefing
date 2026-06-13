// components/primitives/DataFreshness.tsx — "12s ago" + staleness dot
'use client';

import React from 'react';
import { formatDuration } from '@/lib/format';

interface DataFreshnessProps {
  timestamp: string;
  className?: string;
}

export function DataFreshness({ timestamp, className = '' }: DataFreshnessProps) {
  const date = new Date(timestamp);
  const ms = Date.now() - date.getTime();
  const isStale = ms > 300_000; // 5 minutes

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] ${className}`}
      title={`Last updated: ${date.toLocaleString()}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: isStale ? 'var(--color-caution)' : 'var(--color-bull)' }}
        aria-hidden="true"
      />
      <time dateTime={date.toISOString()}>{formatDuration(ms)}</time>
    </span>
  );
}
