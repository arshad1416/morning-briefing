// app/ticker/page.tsx — the ticker lookup, and the fallback company page.
//
// Two jobs, decided client-side because a static export has no server to read
// the query string:
//   • /ticker/            → search for a company by symbol or name
//   • /ticker/?symbol=X   → that company's page, for symbols with no
//                           prerendered route (see ticker-search.tsx)
// Symbols that DO have a prerendered route are served by /ticker/[symbol]/.
import { Suspense } from 'react';
import { TickerLookupClient } from './ticker-lookup-client';
import { getTickerCoverage } from '@/lib/seo/ticker-coverage';
import { buildMetadata } from '@/lib/seo';

// The description must not name indexes. It is baked in at build time, while
// which indexes are actually covered is decided per scan — so any list here
// becomes a promise the data need not keep, and (being a meta description) it
// is the snippet search engines show. The screener makes the same claim but
// derives it from universes_scanned and marks what a run missed; this page has
// no such escape hatch, so it describes the feature instead.
export const metadata = buildMetadata({
  title: 'Ticker Lookup',
  description:
    'Look up any company or fund we track by ticker symbol or name — price, chart signals such as RSI and moving averages, fundamentals, recent SEC filings and the MapleGamma screening score, for US and TSX-listed stocks and ETFs.',
  path: '/ticker/',
});

export default function TickerPage() {
  // Read at build time from the same artifacts that generate the prerendered
  // /ticker/[symbol]/ routes, so the search set and the static route set agree
  // and a result can never link at a 404.
  const index = getTickerCoverage().map(({ symbol, name, sector }) => ({ symbol, name, sector }));

  return (
    <Suspense fallback={null}>
      <TickerLookupClient index={index} />
    </Suspense>
  );
}
