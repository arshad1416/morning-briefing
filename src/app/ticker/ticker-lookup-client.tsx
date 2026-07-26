// app/ticker/ticker-lookup-client.tsx — routes /ticker/ between the lookup and
// a company page.
//
// /ticker/ used to be a dead end: no symbol meant a single line of text telling
// you to go and use the Screener. It is now the search surface, and it keeps
// serving ?symbol= for the symbols that have no prerendered route of their own
// (see the routing note in ticker-search.tsx).
'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { TickerClient } from './ticker-client';
import { TickerSearch, type TickerIndexEntry } from './ticker-search';

export function TickerLookupClient({ index }: { index: TickerIndexEntry[] }) {
  const params = useSearchParams();
  const symbol = (params.get('symbol') || '').trim();

  if (!symbol) return <TickerSearch index={index} />;

  return (
    <div className="space-y-3">
      <Link
        href="/ticker/"
        className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-accent)]"
      >
        <span aria-hidden="true">←</span> Look up another company
      </Link>
      <TickerClient />
    </div>
  );
}
