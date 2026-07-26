// app/ticker/ticker-search.tsx — look one company up by name or symbol.
//
// This is a separate job from the Screener. The Screener answers "show me
// everything that looks like X"; this answers "I already know the company, take
// me to it". They were the same box before, and typing a symbol into the
// Screener's filter left you reading a one-row table instead of a company page.
//
// ROUTING, and the trap it avoids: /ticker/[symbol]/ is a static export with
// `dynamicParams = false`, so a link to a symbol outside getTickerCoverage()
// is a hard 404 — strictly worse than no search at all. Every result therefore
// routes one of two ways:
//   • in the build-time coverage set  → /ticker/SYMBOL/   (prerendered page)
//   • anywhere else                   → /ticker/?symbol=X (this route, client-side)
// Both render the same view; only the first is prerendered for search engines.
'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { screenerQuery } from '@/lib/query/options';

export type TickerIndexEntry = {
  symbol: string;
  name: string;
  sector?: string;
};

/** Static-route coverage, so a result can pick the right href. */
function coverageSet(entries: TickerIndexEntry[]) {
  return new Set(entries.map((entry) => entry.symbol));
}

export function hrefForSymbol(symbol: string, covered: ReadonlySet<string>) {
  const upper = symbol.toUpperCase();
  return covered.has(upper)
    ? `/ticker/${encodeURIComponent(upper)}/`
    : `/ticker/?symbol=${encodeURIComponent(upper)}`;
}

const MAX_RESULTS = 40;

/** Rank: exact symbol, then symbol prefix, then name prefix, then anywhere. */
function rank(entry: TickerIndexEntry, query: string): number {
  const symbol = entry.symbol.toUpperCase();
  const name = entry.name.toUpperCase();
  if (symbol === query) return 0;
  if (symbol.startsWith(query)) return 1;
  if (name.startsWith(query)) return 2;
  if (symbol.includes(query)) return 3;
  if (name.includes(query)) return 4;
  return Number.POSITIVE_INFINITY;
}

export function TickerSearch({ index }: { index: TickerIndexEntry[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);

  // The screener carries names the static coverage set does not (and vice
  // versa) — it is fetched per session and may be gated down to eight rows, so
  // it can only ever ADD to what is searchable, never gate it.
  const { data: screener } = useQuery(screenerQuery());

  const entries = useMemo(() => {
    const merged = new Map<string, TickerIndexEntry>();
    for (const entry of index) merged.set(entry.symbol, entry);
    for (const row of screener?.data?.tickers ?? []) {
      const symbol = row.ticker.toUpperCase();
      const existing = merged.get(symbol);
      merged.set(symbol, {
        symbol,
        name: existing?.name || row.name || symbol,
        sector: existing?.sector || row.sector || undefined,
      });
    }
    return [...merged.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [index, screener]);

  const covered = useMemo(() => coverageSet(index), [index]);

  const results = useMemo(() => {
    const needle = query.trim().toUpperCase();
    if (needle.length < 1) return [];
    return entries
      .map((entry) => ({ entry, score: rank(entry, needle) }))
      .filter((row) => Number.isFinite(row.score))
      .sort((a, b) => a.score - b.score || a.entry.symbol.localeCompare(b.entry.symbol))
      .slice(0, MAX_RESULTS)
      .map((row) => row.entry);
  }, [entries, query]);

  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const typed = query.trim().toUpperCase();
  // A symbol we have never heard of still deserves an answer. /ticker/?symbol=
  // renders the "No data available for X" state, which is a truthful answer —
  // better than a 404, and better than pretending the box does not accept it.
  const unknownSymbol =
    typed.length >= 1 &&
    /^[A-Z0-9][A-Z0-9.\-]{0,14}$/.test(typed) &&
    !results.some((entry) => entry.symbol === typed);

  const go = (symbol: string) => router.push(hrefForSymbol(symbol, covered));

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = results[active]?.symbol ?? (unknownSymbol ? typed : null);
      if (chosen) go(chosen);
    } else if (event.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="relative rounded-[var(--radius-tile)] border p-6"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-[var(--radius-tile)]">
          <span className="glow-orb -top-24 -right-8" />
        </span>
        <h1 className="relative z-10 font-display text-3xl text-[var(--color-text-primary)]">
          Look up a <em className="italic" style={{ color: 'var(--color-accent)' }}>company</em>
        </h1>
        <p className="relative z-10 mt-2 max-w-2xl text-sm text-[var(--color-text-secondary)]">
          Type a ticker symbol or a company name to go straight to its page — price, chart signals, fundamentals,
          filings and the AI Council&apos;s read. If you&apos;d rather browse by criteria than look one name up, use the{' '}
          <Link href="/screener/" className="font-medium text-[var(--color-accent)] hover:underline">Screener</Link>.
        </p>
      </div>

      <div
        className="rounded-[var(--radius-tile)] border p-4"
        style={{ backgroundColor: 'var(--color-bg-surface)', borderColor: 'var(--color-border-subtle)' }}
      >
        <label htmlFor={`${listboxId}-input`} className="block text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--color-text-tertiary)]">
          Ticker symbol or company name
        </label>
        <input
          id={`${listboxId}-input`}
          ref={inputRef}
          type="search"
          role="combobox"
          autoComplete="off"
          aria-expanded={results.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={results[active] ? `${listboxId}-opt-${active}` : undefined}
          aria-describedby={`${listboxId}-hint`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="AAPL, Apple, Shopify, TD.TO…"
          className="mt-1 min-h-11 w-full rounded-lg border bg-[var(--color-bg-elevated)] px-3 text-base text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          style={{ borderColor: 'var(--color-border-default)' }}
        />
        <p id={`${listboxId}-hint`} className="mt-1.5 text-[11px] text-[var(--color-text-tertiary)]">
          {entries.length.toLocaleString('en-US')} companies and funds have a page here. Use ↑ ↓ to move through the
          results and Enter to open one. Toronto-listed names end in <span data-numeric>.TO</span>.
        </p>

        {query.trim() && (
          <>
            <ul
              id={listboxId}
              role="listbox"
              aria-label="Matching companies"
              className="mt-3 max-h-96 divide-y overflow-y-auto rounded-lg border"
              style={{ borderColor: 'var(--color-border-subtle)' }}
            >
              {results.map((entry, i) => (
                <li key={entry.symbol} role="presentation">
                  <Link
                    id={`${listboxId}-opt-${i}`}
                    role="option"
                    aria-selected={i === active}
                    ref={i === active ? activeRef : undefined}
                    href={hrefForSymbol(entry.symbol, covered)}
                    onMouseEnter={() => setActive(i)}
                    className="flex min-h-11 items-center gap-3 px-3 py-2 transition-colors"
                    style={{ backgroundColor: i === active ? 'var(--color-bg-elevated)' : undefined }}
                  >
                    <span className="w-20 shrink-0 font-semibold text-[var(--color-accent)]" data-numeric>{entry.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-[var(--color-text-primary)]">{entry.name}</span>
                    {entry.sector && (
                      <span className="hidden shrink-0 text-xs text-[var(--color-text-tertiary)] sm:inline">{entry.sector}</span>
                    )}
                  </Link>
                </li>
              ))}
              {unknownSymbol && (
                <li role="presentation">
                  <Link
                    href={hrefForSymbol(typed, covered)}
                    className="flex min-h-11 items-center gap-3 px-3 py-2 text-sm"
                  >
                    <span className="w-20 shrink-0 font-semibold text-[var(--color-text-secondary)]" data-numeric>{typed}</span>
                    <span className="min-w-0 flex-1 text-[var(--color-text-secondary)]">
                      Not one of the names we scan — open it anyway to check
                    </span>
                  </Link>
                </li>
              )}
            </ul>
            {!results.length && !unknownSymbol && (
              <p className="mt-3 text-sm text-[var(--color-text-tertiary)]">
                Nothing matches “{query.trim()}”. Try the ticker symbol instead of the full company name.
              </p>
            )}
            {results.length === MAX_RESULTS && (
              <p className="mt-2 text-[11px] text-[var(--color-text-tertiary)]">
                Showing the first {MAX_RESULTS} matches — keep typing to narrow them.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
