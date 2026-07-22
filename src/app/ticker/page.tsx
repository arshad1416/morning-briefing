// app/ticker/page.tsx — per-ticker deep dive. The legacy SPA routed
// #/ticker/:ticker; the static export can't build 677 dynamic routes, so this
// single page reads ?symbol= client-side (linked from the Screener).
import { Suspense } from 'react';
import { TickerClient } from './ticker-client';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Ticker Details',
  description:
    'Price, chart signals, company fundamentals and MapleGamma screening scores for S&P 500 and TSX-listed stocks and ETFs.',
  path: '/ticker/',
});

export default function TickerPage() {
  return (
    <Suspense fallback={null}>
      <TickerClient />
    </Suspense>
  );
}
