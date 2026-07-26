// app/screener/page.tsx — Stock Screener (Basic tier)
import { ScreenerClient } from './screener-client';
import { getTickerCoverage } from '@/lib/seo/ticker-coverage';
import { buildMetadata } from '@/lib/seo';

export const metadata = buildMetadata({
  title: 'Stock Screener',
  description:
    'Screen S&P 500 and TSX names by RSI, volume, P/E, dividend, 52-week range and a 1–10 score — table and treemap views, rebuilt from a daily market snapshot.',
  path: '/screener/',
});

export default function ScreenerPage() {
  // Which symbols actually have a prerendered detail page. /ticker/[symbol]/ is
  // dynamicParams:false, so a row linking outside this set is a hard 404 — and
  // the screener now carries far more rows than there are detail files.
  const coverage = getTickerCoverage().map((entry) => entry.symbol);
  return <ScreenerClient tickerCoverage={coverage} />;
}
