// components/primitives/DataFreshness.tsx — "12s ago" + staleness dot
'use client';

import React, { useEffect, useState } from 'react';
import { formatDuration, parsePipelineTimestamp } from '@/lib/format';

interface DataFreshnessProps {
  /** A pipeline `generated_at`. Naive stamps are read as Pi-local ET — see
   *  parsePipelineTimestamp; anything unparseable renders as unknown. */
  timestamp: string | null | undefined;
  className?: string;
  /** Age after which the dot turns caution-colored. Feeds that regenerate on a
   *  slow cron (e.g. options, ~30 min) should pass a matching threshold so the
   *  dot doesn't read amber while the pipeline is healthy. */
  staleAfterMs?: number;
}

export function DataFreshness({ timestamp, className = '', staleAfterMs = 300_000 }: DataFreshnessProps) {
  // Date.now() differs between the static-export HTML and the client — only
  // compute freshness after mount to avoid a hydration mismatch.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Not `new Date(timestamp)`: the naive ET stamps half the pipeline emits are
  // read in the viewer's zone by that route, and the space-separated form is
  // Invalid Date on WebKit — whose .toISOString() throws rather than degrading.
  const epoch = parsePipelineTimestamp(timestamp);
  const iso = epoch === null ? undefined : new Date(epoch).toISOString();

  // An unusable stamp keeps the pre-mount placeholder for good. Showing an age
  // here would mean inventing one, and the green dot would vouch for it.
  if (!mounted || epoch === null) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] ${className}`}
        title={epoch === null ? 'Last updated: unknown' : undefined}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-bg-elevated)]" aria-hidden="true" />
        <time dateTime={iso}>—</time>
      </span>
    );
  }

  // Clock skew between the Pi and the viewer can date a stamp slightly ahead of
  // the reader; clamping keeps that from rendering as "-10800s ago".
  const ms = Math.max(0, Date.now() - epoch);
  const isStale = ms > staleAfterMs;

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs text-[var(--color-text-tertiary)] ${className}`}
      title={`Last updated: ${new Date(epoch).toLocaleString()}`}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: isStale ? 'var(--color-caution)' : 'var(--color-accent)',
          boxShadow: isStale ? 'none' : '0 0 6px var(--color-accent)',
        }}
        aria-hidden="true"
      />
      <time dateTime={iso}>{formatDuration(ms)}</time>
    </span>
  );
}
